const mysql = require('mysql');
const express = require('express');
var app = express();
const cors = require('cors');
const bodyparser = require('body-parser');
const bcrypt = require('bcrypt');

const path = require('path');
app.use('/public', express.static(path.join(__dirname, 'public')));


// configuring express server
app.use(bodyparser.json());
app.use(cors());

var mysqlConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'banana_leaf'
});

mysqlConnection.connect((err) => {
    if (!err)
        console.log('Database connection successful');
    else
        console.log('Database connection failed \n Error : ' + JSON.stringify(err, undefined, 2));
});




// Test endpoint to check server status
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Get all customers
app.get('/customers', (req, res) => {
    mysqlConnection.query('SELECT * FROM customer', (err, rows, fields) => {
        if (!err)
            res.send(rows);
        else
            res.send(err);
    });
});

// Get a specific customer
app.get('/customers/:id', (req, res) => {
    mysqlConnection.query('SELECT * FROM customer WHERE Customer_ID = ?', [req.params.id], (err, rows, fields) => {
        if (!err)
            res.send(rows);
        else
            res.send(err);
    });
});

// Deleting a specific customer with a given customer id
app.delete('/customers/:id', (req, res) => {
    mysqlConnection.query('DELETE FROM customer WHERE Customer_ID = ?', [req.params.id], (err, rows, fields) => {
        if (!err)
            res.send('Customer deleted successfully');
        else
            res.send(err);
    });
});

//Inserting a customer record
app.post('/customers', async (req, res) => {
    console.log(req.body);
    let fname = req.body.fname;
    let lname = req.body.lname;
    let email = req.body.email;
    let address = req.body.address;
    let mobile = req.body.mobile;
    let password = req.body.password;

    // Check if the customer already exists
    let checkSql = "SELECT * FROM customer WHERE Cust_email = ?";
    mysqlConnection.query(checkSql, [email], async (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ data: 'Database error', status_code: 500 });
        }

        if (result.length > 0) {
            // Customer already exists
            return res.json({ data: 'Customer already registered', status_code: 400 });
        } else {
            // Customer does not exist, proceed with insert
            let insertSql = "INSERT INTO customer(Cust_FName, Cust_LName, Cust_email, Cust_Address, Cust_Contact) VALUES(?, ?, ?, ?, ?)";
            mysqlConnection.query(insertSql, [fname, lname, email, address, mobile], async (err, result) => {
                if (!err) {
                    let customerId = result.insertId;

                    // Hash the password
                    const saltRounds = 10;
                    const hashedPassword = await bcrypt.hash(password, saltRounds);

                    // Insert login info
                    let loginSql = "INSERT INTO login_info(Login_username, Login_password, User_ID) VALUES(?, ?, ?)";
                    mysqlConnection.query(loginSql, [email, hashedPassword, customerId], (err, result) => {
                        if (!err) {
                            console.log(result);
                            return res.json({ data: 'Customer and login info inserted successfully', status_code: 200 });
                        } else {
                            console.log(err);
                            return res.json({ data: 'Error inserting login info', status_code: 500 });
                        }
                    });
                } else {
                    console.log(err);
                    return res.json({ data: 'Error inserting customer', status_code: 500 });
                }
            });
        }
    });
});


//Customer login
app.post('/signin', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    let sql = "SELECT * FROM login_info WHERE Login_username = ?";
    mysqlConnection.query(sql, [email], async (err, result) => {
        if (err) {
            console.log(err);
            return res.json({ data: 'Database error', status_code: 500 });
        }

        if (result.length === 0) {
            return res.json({ data: 'User not found', status_code: 400 });
        }

        const user = result[0];
        console.log("user",user)
        const isValidPassword = bcrypt.compare(password, user.Login_password);
        
        console.log("password",isValidPassword);
        if (isValidPassword) {
            return res.json({ data:{Login_username:email}, status_code: 200 });
        } 
        else {
            return res.json({ data: 'Invalid password', status_code: 400 });
        }
    });
});

// Get all menu items
app.get('/menu_items', async(req, res) => {
    mysqlConnection.query('SELECT * FROM menu_item', (err, rows, fields) => {
        if (!err)
            res.send(rows);
        else
            res.send(err);
    });
});


// Endpoint to place an order
app.post('/place_order', (req, res) => {
    const { custId, cart } = req.body;

    const orderDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const orderTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

    mysqlConnection.beginTransaction((err) => {
        if (err) {
            return res.json({ data: 'Transaction error', status_code: 500 });
        }

        // Insert into food_order
        const insertOrderQuery = "INSERT INTO food_order (Cust_ID, Order_Date, Order_Time) VALUES (?, ?, ?)";
        mysqlConnection.query(insertOrderQuery, [custId, orderDate, orderTime], (err, result) => {
            if (err) {
                return mysqlConnection.rollback(() => {
                    res.json({ data: 'Error inserting order', status_code: 500 });
                });
            }

            const orderNo = result.insertId;

            // Insert into order_item
            const insertOrderItemQuery = "INSERT INTO order_item (Order_No, Item_ID, Quantity) VALUES ?";
            const orderItems = cart.map(item => [orderNo, item.id, item.quantity]);
            mysqlConnection.query(insertOrderItemQuery, [orderItems], (err, result) => {
                if (err) {
                    return mysqlConnection.rollback(() => {
                        res.json({ data: 'Error inserting order items', status_code: 500 });
                    });
                }

                mysqlConnection.commit((err) => {
                    if (err) {
                        return mysqlConnection.rollback(() => {
                            res.json({ data: 'Transaction commit error', status_code: 500 });
                        });
                    }
                    res.json({ data: 'Order placed successfully', status_code: 200 });
                });
            });
        });
    });
});



// Change the port to 8080 for testing
const PORT = 8080;
app.listen(PORT, () => console.log(`Express server is running at port no : ${PORT}`));