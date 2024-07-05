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
  const { email, phoneNumber } = req.body;

  try{
    let [  phoneRecords, phoneRecordsFields ] = await connection.promise().query('SELECT * FROM customers WHERE phoneNumber = ? ORDER BY id ASC', [phoneNumber]);
    let [  emailRecords, emailRecordsFields ] = await connection.promise().query('SELECT * FROM customers WHERE email = ? ORDER BY id ASC', [email]);


    // console.log("phoneRecords: ", phoneRecords);
    // console.log("emailRecords: ", emailRecords);

    if(phoneRecords == undefined)
        phoneRecords = [];
    if(emailRecords == undefined)
        emailRecords = [];


    if(phoneRecords.length == 0 && emailRecords.length == 0){
      // no previous records. create new primary record.

        const [record, fields] = await connection.promise().execute(`INSERT INTO customers (phoneNumber, email, linkPrecedence, createdAt, updatedAt) VALUES ( ? , ?, "primary", NOW(), NOW());`, [phoneNumber, email]);
        
          let result = {
              contact: {
                primaryContatctId: record.insertId,
                emails: email,
                phoneNumbers: phoneNumber,
                secondaryContactIds: []
              }
            };

        console.log("primary result: " , result);
        res.json(result);

    }else if((phoneRecords.length == 0 && emailRecords.length != 0) || (phoneRecords.length != 0 && emailRecords.length == 0)){
      // previous primary record found. create a secondary record.

        const [record, fields] = await connection.promise().execute(`INSERT INTO customers (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt) VALUES (${phoneNumber}, "${email}", "${emailRecords.length > 0 ? emailRecords[0].id : phoneRecords[0].id}","secondary", NOW(), NOW());`, []);
        let [  allRecords, allRecordsFields ] = await connection.promise().query('SELECT * FROM customers WHERE email = ? OR phoneNumber = ? ORDER BY id ASC', [email, phoneNumber]);
          
          let emails = [];
          let phoneNumbers = [];
          let secondaryContactIds = [];
          let primaryContatctId = null;

          allRecords.forEach((item)=>{

            if(!secondaryContactIds.includes(item.id) && item.linkPrecedence!="primary")
              secondaryContactIds.push(item.id);
            if(!emails.includes(item.email))
              emails.push(item.email);
            if(!phoneNumbers.includes(item.phoneNumber))
              phoneNumbers.push(item.phoneNumber);
            if(item.linkPrecedence=="primary")
              primaryContatctId = item.id;

          });

          let result = {
              contact: {
                primaryContatctId: primaryContatctId,
                emails: emails,
                phoneNumbers: phoneNumbers,
                secondaryContactIds: secondaryContactIds
              }
            };


        console.log("secondary result: " , result);
        res.json(result);

    }

  }catch(err){
    console.log(err);
    throw err;
  }
  
});