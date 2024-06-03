const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
// middleWare
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nzlapl6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        // _____________________________Collections_________________

        const userCollections = client.db('uniScholarPath').collection('users');
        const scholarshipCollections = client.db('uniScholarPath').collection('scholarship');


        // _____________________________Start________________________

        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            }).send({ success: true })
        })

        // Logout
        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })
        // Verify Token Middleware
        const verifyToken = async (req, res, next) => {
            const token = req.cookies?.token
            if (!token) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    console.log(err)
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.user = decoded
                next()
            })
        }

        // verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.user.email;
            const query = { email: email };
            const user = await userCollections.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // user api
        app.post('/users', async (req, res) => {
            const users = req.body;
            const existUser = await userCollections.findOne({ email: users.email });
            if (existUser) {
                return res.send({ insertedId: null })
            }
            const result = await userCollections.insertOne(users);
            res.send(result);
        });
        // get users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollections.find().toArray();
            res.send(result);
        });
        app.get('/users/:email', async (req, res) => {
            const result = await userCollections.find({ email: req.params.email }).toArray();
            res.send(result);
        });

        app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { role } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: role
                }
            };
            const result = await userCollections.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {


            if (req.params.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: req.params.email };
            const user = await userCollections.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.get('/users/moderator/:email', verifyToken, async (req, res) => {


            if (req.params.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: req.params.email };
            const user = await userCollections.findOne(query);
            let moderator = false;
            if (user) {
                moderator = user?.role === 'moderator';
            }
            res.send({ moderator });
        })

        app.get('/users/student/:email', verifyToken, async (req, res) => {


            if (req.params.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: req.params.email };
            const user = await userCollections.findOne(query);
            let student = false;
            if (user) {
                student = user?.role === 'user';
            }
            res.send({ student });
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const result = await userCollections.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        })
        // ____________________________X_______________________________


        // _______________________________Scholarship___________________

        app.post('/scholarships', async (req, res) => {
            const scholarship = req.body;
            const result = await scholarshipCollections.insertOne(scholarship);
            res.send(result);
        })


        app.get('/scholarships', async (req, res) => {
            try {
                const scholarships = await scholarshipCollections.aggregate([
                    {
                        $addFields: {
                            tuitionFeesNumber: { $toDouble: "$tuitionFees" },
                        }
                    },
                    {


                        $sort: {
                            tuitionFeesNumber: 1,  // Sort by tuitionFees in ascending order
                        }
                    }

                ]).toArray();
                res.send(scholarships);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch scholarships', error });
            }
        });

        app.get('/scholarships/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await scholarshipCollections.findOne({ _id: new ObjectId(id) })
            res.send(result);
        })

        app.patch('/scholarships/:id', async (req, res) => {
            const updatedScholarship = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    scholarshipName: updatedScholarship.scholarshipName,
                    universityName: updatedScholarship.universityName,
                    universityCountry: updatedScholarship.universityCountry,
                    universityCity: updatedScholarship.universityCity,
                    universityRank: updatedScholarship.universityRank,
                    subjectCategory: updatedScholarship.subjectCategory,
                    scholarshipCategory: updatedScholarship.scholarshipCategory,
                    degree: updatedScholarship.degree,
                    tuitionFees: updatedScholarship.tuitionFees,
                    applicationFees: updatedScholarship.applicationFees,
                    serviceCharge: updatedScholarship.serviceCharge,
                    universityLogo: updatedScholarship.universityLogo
                }
            };

            const result = await scholarshipCollections.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete('/scholarships/:id', async (req, res) => {
            const id = req.params.id;
            const result = await scholarshipCollections.deleteOne({ _id: new ObjectId(id) });
            res.send(result)
        })
        //_______________________X______________________ 


        //  _____________________Apply____________________

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })






        // ______________________________X____________________________________
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('The final assignment will be rock........')
})
app.listen(port, () => {
    console.log(`the post number is ${port}`);
})