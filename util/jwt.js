import jwt from "jsonwebtoken";
import * as jwtAWS from "aws-jwt-verify";
import { json } from "express";

// Using a fixed authentication secret for demonstration purposes.
// Ideally this would be stored in a secrets manager and retrieved here.
// To create a new randomly chosen secret instead, you can use:
//
// tokenSecret = require("crypto").randomBytes(64).toString("hex");
//
const tokenSecret =
   "e9aae26be08551392be664d620fb422350a30349899fc254a0f37bfa1b945e36ff20d25b12025e1067f9b69e8b8f2ef0f767f6fff6279e5755668bf4bae88588";

// Create a token with username embedded, setting the validity period.
const generateAccessToken = (username) => {
   return jwt.sign(username, tokenSecret, { expiresIn: "30m" });
};
const clientId = "5keiclttbbi3a8cp46fc6ek60r";
const userPoolId = "ap-southeast-2_pEnkZyq4S"

const idVerifier = jwtAWS.CognitoJwtVerifier.create({
   userPoolId: userPoolId,
   tokenUse: "id",
   clientId: clientId,
 });







// Middleware to verify a token and respond with user information
const authenticateToken = async (req, res, next) => {
   // We are using Bearer auth.  The token is in the authorization header.
   console.log("doing token")
   const authHeader = req.headers["authorization"];
   const token = authHeader && authHeader.split(' ')[1];
   console.log(token)


   if (!token) {
      console.log("JSON web token missing.");
      return res.sendStatus(401);
   }

   // Check that the token is valid
   try {
      const user = await idVerifier.verify(token);
      
      console.log(`user: ${user}`)
      console.log(
         `authToken verified for user: ${user.username} at URL ${req.url}`
      );

      // Add user info to the request for the next handler
      req.user = user;
      next();
   } catch (err) {
      console.log(
         `JWT verification failed at URL ${req.url}`,
         err.name,
         err.message
      );
      return res.sendStatus(401);
   }
};


async function decodeUserToken(req) {
   // We are using Bearer auth.  The token is in the authorization header.

   //console.log(`req: ${req}`)

   const authHeader = req.headers["authorization"];
   console.log(authHeader)
   const token = authHeader && authHeader.split(' ')[1];
   console.log("token")
   console.log(token)

   if (!token) {
      console.log("JSON web token missing.");
      return 401
   }

   // Check that the token is valid
   try {
      const user = await idVerifier.verify(token);
   console.log(`username==: ${user['cognito:username']}`)
      return user['cognito:username']
   } catch (err) {
      console.log(
         err.name,
         err.message
      );
      return 401
   }
};

// async function decodeUserToken(req) {
//    // Log the request for debugging
//    console.log(`req: ${JSON.stringify(req)}`);

//    // Extract the authorization header from the request
//    const authHeader = req.headers && req.headers["authorization"];
//    console.log("Authorization Header:", authHeader);
   
//    // Extract the token from the authorization header
//    const token = authHeader && authHeader.split(' ')[1];
//    console.log("Token:", token);

//    if (!token) {
//       console.log("JSON web token missing.");
//       return 401; // Or handle as appropriate for your application
//    }

//    // Check that the token is valid
//    try {
//       const user = await idVerifier.verify(token);
//       return user.username;
//    } catch (err) {
//       console.log(err.name, err.message);
//       return 401; // Or handle as appropriate for your application
//    }
// }




export default { generateAccessToken, authenticateToken, decodeUserToken };
