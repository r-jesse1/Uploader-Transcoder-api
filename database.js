//import { SecretsManager } from 'aws-sdk';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import mariadb from 'mariadb';
import fs from 'fs';
import { promisify } from 'util';
import Memcached from 'memcached';

const memcachedClient = new Memcached('n11411911-assessment.km2jzi.cfg.apse2.cache.amazonaws.com:11211');

const cachePrefix = 'publicVideos'; 
const allowedSortColumns = ['name', 'uploadDate', 'size', 'owner', 'length']; // List of all possible sort columns



// Function to retrieve secrets from AWS Secrets Manager
async function getSecrets() {
  const secretName = "n11411911-assessment-db";
  const client = new SecretsManagerClient({ region: "ap-southeast-2" });

  try {
    const response = await client.send(new GetSecretValueCommand({
      SecretId: secretName,
      VersionStage: "AWSCURRENT",
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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS transcode_journal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id VARCHAR(50) NOT NULL,
        progress_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        user VARCHAR(50) NOT NULL,
        resolution VARCHAR(50),
        fileType VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(ID)
      )
    `);

  } catch (error) {
    console.error("Error creating tables: ", error.message);
  } finally {
    if (conn) conn.release();
  }
}






const insertVideo = async (data) => {
  try {
    const result = await pool.execute(
      `INSERT INTO videos (ID, name, owner, resolution, uploadDate, private, size, length, fileType) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.ID, data.name, data.owner, data.resolution, data.uploadDate, data.private, data.size, data.length, data.fileType]
    );
    console.log(`Inserted a row with the ID: ${result.insertId}`);

    // Invalidate caches for all sort orders
    await Promise.all(allowedSortColumns.map(async (sortColumn) => {
      const cacheKey = `${cachePrefix}_${sortColumn}`;
      await promisify(memcachedClient.delete).bind(memcachedClient)(cacheKey);
      console.log(`Cache invalidated for sort order: ${sortColumn}`);
    }));

    return null;  // No error
  } catch (error) {
    console.error("Error inserting video: ", error.message);
    return error.message;  // Return the error
  }
};

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
    // Only cache if search is empty
    const useCache = !search || search.trim() === "";
    const cacheKey = useCache ? `${cachePrefix}_${sort}` : null;  // Create a unique cache key for each sort order

    // Check if the result is cached (only if search is empty)
    if (useCache && cacheKey) {
      const cachedResult = await promisify(memcachedClient.get).bind(memcachedClient)(cacheKey);
      if (cachedResult) {
        console.log('Cache hit for sort order:', sort);
        return JSON.parse(cachedResult);
      }
      console.log('Cache miss for sort order:', sort);
    }

    conn = await pool.getConnection();
    let res;

    if (!allowedSortColumns.includes(sort)) {
      throw new Error("Invalid sort column");
    }

    if (useCache) {
      // Sort without search
      res = await conn.query(`SELECT * FROM videos WHERE private = FALSE ORDER BY ${sort}`);
    } else {
      // Use parameterized query for search
      res = await conn.query(`SELECT * FROM videos WHERE private = FALSE AND name LIKE ? ORDER BY ${sort}`, [`%${search}%`]);
    }

    // Cache the result (only if search is empty)
    if (useCache) {
      await promisify(memcachedClient.set).bind(memcachedClient)(cacheKey, JSON.stringify(res), 300); // Cache for 5 minutes
      console.log('Cached result for sort order:', sort);
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

    // Invalidate caches for all sort orders
    await Promise.all(allowedSortColumns.map(async (sortColumn) => {
      const cacheKey = `${cachePrefix}_${sortColumn}`;
      await promisify(memcachedClient.delete).bind(memcachedClient)(cacheKey);
      console.log(`Cache invalidated for sort order: ${sortColumn}`);
    }));

    return res;
  } catch (error) {
    console.error(error.message);
  } finally {
    if (conn) conn.release();
  }
};


function setTranProgress(progressID, progress) {
  return new Promise((resolve, reject) => {
      memcachedClient.set(progressID, progress, 3600, (err) => {
          if (err) {
              console.error('Error setting progress in Memcached:', err);
              reject(err);
          } else {
            console.log(`setting id ${progressID} progress: ${progress}`)
            
              resolve();
          }
      });
  });
}


function getTranProgress(progressID) {
  return new Promise((resolve, reject) => {
    memcachedClient.get(progressID, (err, data) => {
          if (err) {
              reject(err);
          } else {
              resolve(data ? JSON.parse(data) : null);
          }
      });
  });
}


const createTranscodingJournal = async (videoID, progressID, resolution, fileType, user) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      INSERT INTO transcode_journal (video_id, progress_id, status, resolution, fileType, user)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await conn.query(query, [videoID, progressID, 'started', resolution, fileType, user]);
  } catch (error) {
    console.error("Error creating transcoding entry: ", error.message);
  } finally {
    if (conn) conn.release();
  }
};

const updateTranscodingJournal = async (progressID, status) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      UPDATE transcode_journal
      SET status = ?
      WHERE progress_id = ?
    `;
    await conn.query(query, [status, message, progressID]);
  } catch (error) {
    console.error("Error updating transcoding status: ", error.message);
  } finally {
    if (conn) conn.release();
  }
};

const getIncompleteTranscodes = async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT * FROM transcode_journal
      WHERE status != 'completed'
    `;
    const result = await conn.query(query);
    return result;
  } catch (error) {
    console.error("Error fetching incomplete transcodes: ", error.message);
  } finally {
    if (conn) conn.release();
  }
};

export { createDbConnection, insertVideo, getVideoDataByID, getPublicVideos, getPrivateVideos, deleteVideoDataByID, getTranProgress, setTranProgress, createTranscodingJournal, updateTranscodingJournal, getIncompleteTranscodes };