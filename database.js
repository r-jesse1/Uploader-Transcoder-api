//import { SecretsManager } from 'aws-sdk';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import mariadb from 'mariadb';
import fs from 'fs';
import { promisify } from 'util';



// Function to retrieve secrets from AWS Secrets Manager
async function getSecrets() {
  const secretName = "n11411911-assessment-db";
  const client = new SecretsManagerClient({ region: "ap-southeast-2" });

  try {
    const response = await client.send(new GetSecretValueCommand({
      SecretId: secretName,
      VersionStage: "AWSCURRENT", // Default to AWSCURRENT
    }));

    const secretString = response.SecretString;
    if (!secretString) {
      throw new Error("Secret string is empty.");
    }
    
    return JSON.parse(secretString);
  } catch (error) {
    console.error("Error retrieving secret:", error);
    throw error;
  }
}

// Create a MariaDB connection pool using secrets
async function createPool() {
  try {
    const secrets = await getSecrets();
    const pool = mariadb.createPool({
      host: secrets.host,
      user: secrets.username,
      password: secrets.password,
      database: secrets.dbname,
      connectionLimit: 5
    });

    return pool;
  } catch (error) {
    console.error("Error creating connection pool:", error);
    throw error;
  }
}

// Export the pool for use in other functions
const pool = await createPool();






// // // Create a MariaDB connection pool
// const pool = mariadb.createPool({
//   host: 'n11411911-assessment-mariadb.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com', 
//   user: "admin", 
//   password: "secretpassword", 
//   database: 'n11411911', 
//   connectionLimit: 5
// });



// let SecretsManagerClient = new SecretsManager({
//   region: "ap-southeast-2",
// });

// const SecretsManagerResult = await SecretsManagerClient
//   .getSecretValue({
//     SecretId: secret_name,
//   })
//   .promise();

// console.log(SecretsManagerResult)
createTable();

async function createDbConnection() {
  let conn;
  try {

    conn = await pool.getConnection();

    // Check if table exists and create if not
    const tables = await conn.query("SHOW TABLES LIKE 'videos'");
    if (tables.length === 0) {
      console.log("Table 'videos' does not exist. Creating table...");
      await createTable(conn);
      console.log("Table 'videos' created successfully.");
    } else {
      console.log("Table 'videos' already exists.");
    }
  } catch (error) {
    console.error("Error in createDbConnection: ", error.message);
  } finally {
    if (conn) conn.release(); // Release connection back to the pool
  }
}

async function createTable() {
  let conn;
  conn = await pool.getConnection();

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS videos (
        ID VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner VARCHAR(50) NOT NULL,
        resolution VARCHAR(50) NOT NULL,
        uploadDate DATE NOT NULL,
        private BOOLEAN NOT NULL,
        size VARCHAR(50) NOT NULL,
        length VARCHAR(50) NOT NULL,
        fileType VARCHAR(50) NOT NULL
      )
    `);
  } catch (error) {
    console.error("Error creating table: ", error.message);
  }
}




async function insertVideo(data) {
  try {
    const result = await pool.execute(
      `INSERT INTO videos (ID, name, owner, resolution, uploadDate, private, size, length, fileType) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.ID, data.name, data.owner, data.resolution, data.uploadDate, data.private, data.size, data.length, data.fileType]
    );
    console.log(`Inserted a row with the ID: ${result.insertId}`);
    return null;  // No error
  } catch (error) {
    console.error("Error inserting video: ", error.message);
    return error.message;  // Return the error
  }
}

const getVideoDataByID = async (ID) => {
  let conn;
  try {

    conn = await pool.getConnection();
    const res = await conn.query(`SELECT * FROM videos WHERE ID = ?`, [ID]);
    return res[0]; // MariaDB query returns an array, so we get the first element
  } catch (error) {
    console.error(error.message);
  } finally {
    if (conn) conn.release();
  }
};

const getPublicVideos = async (sort, search) => {
  let conn;

  try {
    conn = await pool.getConnection();
    let res;
    
    // Whitelist allowed sort columns to avoid SQL injection
    const allowedSortColumns = ['name', 'uploadDate', 'resolution']; // Add valid columns
    if (!allowedSortColumns.includes(sort)) {
      throw new Error("Invalid sort column");
    }
    
    if (!search || search.trim() === "") {
      // Sort by a whitelisted column
      res = await conn.query(`SELECT * FROM videos WHERE private = FALSE ORDER BY ${sort}`);
    } else {
      // Use parameterized query for search
      res = await conn.query(`SELECT * FROM videos WHERE private = FALSE AND name LIKE ? ORDER BY ${sort}`, [`%${search}%`]);
    }
    
    return res;
  } catch (error) {
    console.error(error.message);
    return [];
  } finally {
    if (conn) conn.release();
  }
};

const getPrivateVideos = async (user) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const res = await conn.query(`SELECT * FROM videos WHERE owner = ?`, [user]);
    return res;
  } catch (error) {
    console.error(error.message);
  } finally {
    if (conn) conn.release();
  }
};

const deleteVideoDataByID = async (ID) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const res = await conn.query(`DELETE FROM videos WHERE ID = ?`, [ID]);
    return res;
  } catch (error) {
    console.error(error.message);
  } finally {
    if (conn) conn.release();
  }
};

export { createDbConnection, insertVideo, getVideoDataByID, getPublicVideos, getPrivateVideos, deleteVideoDataByID };