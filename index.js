
const express = require("express");

const app = express ();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

const mysql = require('mysql2');

// MySQL connection configuration

// uses MySQL running on localhost 
// const connection = mysql.createConnection({
//   host: '0.0.0.0',    // MySQL host 
//   user: 'sarath',         // MySQL username 
//   password: 'bitespeed',         // MySQL password 
//   database: 'identity_reconciliation'  // Name of database
// });

// uses remote db 
const connection = mysql.createConnection({
    host: 'sql.freedb.tech',
    user: 'freedb_sarath',
    password: 'wMMXVy9xEXR9&5*',
    database: 'freedb_identity_reconciliation',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);
});



// begin

app.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;
try{
  let [  phoneRecords, phoneRecordsFields ] = await connection.promise().query('SELECT * FROM customers WHERE phoneNumber = ? ORDER BY id ASC', [phoneNumber]);
  let [  emailRecords, emailRecordsFields ] = await connection.promise().query('SELECT * FROM customers WHERE email = ? ORDER BY id ASC', [email]);

  if(phoneRecords == undefined)
      phoneRecords = [];
  if(emailRecords == undefined)
      emailRecords = [];

    if(phoneRecords.length == 0 && emailRecords.length == 0){
      // no previous records. create new primary record.

        if(phoneNumber!=null && email!=null)
          await connection.promise().execute(`INSERT INTO customers (phoneNumber, email, linkPrecedence, createdAt, updatedAt) VALUES ( ? , ?, "primary", NOW(), NOW());`, [phoneNumber, email]);
        
        let result = await getIdentities(email, phoneNumber);
        // console.log("primary result: " , result);
        res.json(result);

    }else if((phoneRecords.length == 0 && emailRecords.length != 0) || (phoneRecords.length != 0 && emailRecords.length == 0)){
      // 1 previous primary record found. create a secondary record.

        if(phoneNumber!=null && email!=null)
          await connection.promise().execute(`INSERT INTO customers (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt) VALUES (${phoneNumber}, "${email}", "${emailRecords.length > 0 ? (emailRecords[0].linkedId == null ? emailRecords[0].id : emailRecords[0].linkedId) : (phoneRecords[0].linkedId == null ? phoneRecords[0].id : phoneRecords[0].linkedId)}","secondary", NOW(), NOW());`, []);
        
        let result = await getIdentities(email, phoneNumber);
        // console.log("secondary result: " , result);
        res.json(result);

    }else if((phoneRecords.length > 0 && emailRecords.length > 0)){

      if(phoneRecords[0].phoneNumber == phoneNumber && emailRecords[0].phoneNumber == phoneNumber){
        // there's only 1 primary record. return it.
        let result = await getIdentities(email, phoneNumber);
        // console.log("secondary result: " , result);
        res.json(result);

      }else{
        // 2 different prev primary records found. update 2nd record to secondary.

          if(phoneRecords[0].id < emailRecords[0].id){
            // phoneRecords[0] is super primary
            await connection.promise().query(`UPDATE customers SET linkedId = ${phoneRecords[0].id}, linkPrecedence = 'secondary', updatedAt = NOW() WHERE id = ${emailRecords[0].id} OR linkedId = ${emailRecords[0].id};`);
              if(err) throw err;

              let result = await getIdentities(email, phoneNumber);
              // console.log("phoneRecords super primary result: " , result);
              res.json(result);

          }else{
            // emailRecords[0] is super primary
            await connection.promise().query(`UPDATE customers SET linkedId = ${emailRecords[0].id}, linkPrecedence = 'secondary', updatedAt = NOW() WHERE id = ${phoneRecords[0].id} OR linkedId = ${phoneRecords[0].id};`);

              let result = await getIdentities(email, phoneNumber);
              // console.log("emailRecords super primary result: " , result);
              res.json(result);

          }

      }
    }else{
      console.log("no data found");
    }
}catch(err){
  console.log("error found: ", err);
  throw err;
}


  async function getIdentities(email, phoneNumber){ 
    let selectQuery = "SELECT * FROM customers WHERE phoneNumber = ? OR email = ? ORDER BY id ASC";
    try{
      let [ records, fields ] = await connection.promise().query(selectQuery, [phoneNumber, email]);

      // edge case 1:
      // by now all the secondary contacts should have been linked together by linkedId
      // and the given parameters only match the secondaries directly, then get the primary using the linkedId.

      selectQuery = "SELECT * FROM customers WHERE id = ? ORDER BY id ASC";
      let [ newrecords, newfields ] = await connection.promise().query(selectQuery, [records[0].linkedId]);
      records.push(...newrecords);


      // edge case 2:
      // if either email or phone number input is null, find all other linked records using the available parameter 
      // and append them to the above records for further processing.
      if(email == null){

        selectQuery = "SELECT * FROM customers WHERE email = ? ORDER BY id ASC";
        let [ newrecords, newfields ] = await connection.promise().query(selectQuery, [records[0].email]);
        records.push(...newrecords);

      }else if(phoneNumber == null){

        selectQuery = "SELECT * FROM customers WHERE phoneNumber = ? ORDER BY id ASC";
        let [ newrecords, newfields ] = await connection.promise().query(selectQuery, [records[0].phoneNumber]);
        records.push(...newrecords);

      }

      // console.log("get identity records: ", records);

        if(records.length>0){
          // records.length has to be greater than 0 at this point.

          let emails = [];
          let phoneNumbers = [];
          let secondaryContactIds = [];
          let primaryContatctId = null;


          records.forEach((item)=>{

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

          // console.log("get identity result: ", result);
          return result;
        }else{
          // console.log("get identity result empty");
        }

    }catch(err){
      console.log(err);
      throw err;
    }
  }


});
// end 