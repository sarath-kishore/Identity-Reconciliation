const express = require("express");

const app = express ();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

const mysql = require('mysql2');

// MySQL connection configuration 
// uses MySQL server running on local machine
const connection = mysql.createConnection({
  host: 'localhost',    // MySQL host 
  user: 'root',         // MySQL username 
  password: '',         // MySQL password 
  database: 'identity_reconciliation'  // Name of database
});


// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);
});


// creating endpoint for POST.
app.post("/identify", async (req, res) => {
  const { message } = req.body; 

  res.json({
    status: "POST endpoint working",
    message: message
  }); // returning the message received through request body.

});