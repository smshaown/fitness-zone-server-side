const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();
// const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const port = process.env.PORT || 5000;

// // middleware;
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
// middleware
app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unAuthorized Access" });
  }
  const token = authorization.split(" ")[1];
  // console.log(token);
  // token verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unAuthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.bdh99op.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

 


    const usersCollection = client.db("assinment12").collection("users");
    const classesCollection = client.db("assinment12").collection("class");

    const bookedCourseCollection = client.db("assinment12").collection("course");
    const paymentsCollection = client.db("assinment12").collection("payment");
    const enrolledCollection = client.db("assinment12").collection("enrolledClass");
    const featuredClassCollection = client.db("assinment12").collection("featuredClass");

    // generate jwt token
    app.post("/jwt", (req, res) => {
      const email = req.body;
      // console.log(email);
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      // console.log(token);
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log(user);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

  
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // update user admin

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false } || { instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" } || {
        instructor: user?.role === "instructor",
      };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Make Instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/featured-class", async (req, res) => {
      const result = await featuredClassCollection.find().toArray();
      res.send(result);
    });
    app.get("/all-class", async (req, res) => {
      const statusFilter = req.query.status; 
      let filter = {}; 

      if (statusFilter === "approved") {
        filter = { status: "approved" }; 
      }

      try {
        const result = await classesCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to retrieve classes" });
      }
    });

    app.get("/update-class/:id", async (req, res) => {
      const result = await classesCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // save a Class in database
    app.post("/class", async (req, res) => {
      const classesData = req.body;

      const result = await classesCollection.insertOne(classesData);
      res.send(result);
    });
    // Manage Classes route
    app.get("/users/classes", async (req, res) => {
      try {
        const classes = await classesCollection.find().toArray();
        res.send(classes);
      } catch (err) {
        console.error("Error retrieving classes from the database", err);
        res.status(500).json({ error: "An error occurred" });
      }
    });

    // Approve Class
    app.put("/classes/:id/approve", async (req, res) => {
      const classId = req.params.id;

      // Update the class status to approved
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $set: { status: "approved" } }
      );

      res.send(result);
    });

    app.put("/classes/:id/deny", async (req, res) => {
      const classId = req.params.id;

      // Update the class status to denied
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $set: { status: "denied" } }
      );
      res.send(result);
    });

    // Add feedback to a class
    app.patch("/classes/:classId/feedback", async (req, res) => {
      const classId = req.params.classId;
      const { feedback } = req.body;

      // Update the class with the feedback
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(classId) },
        {
          $set: { feedback: feedback },
        }
      );

      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      try {
        // Retrieve the instructor data
        const instructors = await classesCollection
          .find()
          .project({ instructor: { name: 1, image: 1, email: 1 } })
          .toArray();

        // Send the instructor data as a response
        res.send(instructors);
      } catch (error) {
        console.error("Error retrieving instructors:", error);
        res.status(500).json({ error: "Failed to retrieve instructors" });
      }
    });

    app.post("/select-class", async (req, res) => {
      const classes = req.body;
      const result = await bookedCourseCollection.insertOne(classes);
      res.send(result);
    });
    // get  mu class for instructors
    app.get("/my-class", async (req, res) => {
      const userEmail = req.query.email;

      try {
        const result = await classesCollection
          .find({ "instructor.email": userEmail })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error("Error retrieving classes:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Update A class
    app.put("/classUpdate/:id", async (req, res) => {
      const classUpdate = req.body;
      const filter = { _id: new ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: classUpdate,
      };
      const result = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // API endpoint to get selected classes for a student
    app.get("/student/classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      // console.log({ decodedEmail });
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await bookedCourseCollection.find(query).toArray();
      res.send(result);
    });

    // API endpoint to remove a selected class
    app.delete("/student/classes/:id", async (req, res) => {
      const id = req.params.id;
      // Delete the selected class for the student
      const result = await bookedCourseCollection.deleteOne({
        _id: new ObjectId(id),
      });
      console.log(result);
      res.send(result);
    });

    //payment stipe impliment here
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    
    app.post("/payments", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      try {
        const insertResult = await paymentsCollection.insertOne(paymentInfo);

        const email = paymentInfo.email;
        const query = { email: email };
        const classDoc = await bookedCourseCollection.findOne(query);
        if (!classDoc) {
          return res.status(404).json({ error: "Class not found" });
        }
        if (classDoc.availableSeats === 0) {
          return res.status(400).json({ error: "No available seats" });
        }
        const updateResult = await enrolledCollection.insertOne(classDoc);
        await bookedCourseCollection.deleteOne(query);

        // Increment the totalEnrolledStudents field in the class document
        await enrolledCollection.updateOne(
          { _id: classDoc._id },
          { $inc: { totalEnrolledStudents: 1 } }
        );
        await classesCollection.updateOne(
          { _id: classDoc._id },
          { $inc: { totalEnrolledStudents: 1 } }
        );

        res.send({ insertResult, updateResult });
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to process payment and enroll in class" });
      }
    });

    // Fetch enrolled classes for a student
    app.get("/enrolled-classes", async (req, res) => {
      try {
        const enrolledClasses = await paymentsCollection
          .find({ email: req.query.email })
          .toArray();

        res.send(enrolledClasses);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to retrieve enrolled classes" });
      }
    });

    // Route to get payment history for a student
    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      try {
        const payments = await paymentsCollection
          .find({ email: email })
          .sort({ date: -1 }) 
          .toArray();
        res.send(payments);
      } catch (error) {
        console.error("Error retrieving payment history:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Route to get popular classes based on the number of students
    app.get("/popular-classes", async (req, res) => {
      try {
        const popularClasses = await enrolledCollection
          .find()
          .sort({ totalEnrolledStudents: -1 })
          .limit(6)
          .toArray();

        res.send(popularClasses);
      } catch (error) {
        console.error("Error retrieving popular classes:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Route to get popular instructors based on the number of students in their class
    app.get("/popular-instructors", async (req, res) => {
      try {
        const popularInstructors = await enrolledCollection
          .aggregate([
            {
              $group: {
                _id: "$selectedClass",
                instructorName: { $first: "$selectedClass.instructor.name" },
                instructorImage: { $first: "$selectedClass.instructor.image" },
                totalEnrolledStudents: {
                  $sum: "$totalEnrolledStudents",
                },
              },
            },
            {
              $sort: { totalEnrolledStudents: -1 },
            },
            {
              $limit: 6,
            },
          ])
          .toArray();

        res.send(popularInstructors);
      } catch (error) {
        console.error("Error retrieving popular instructors:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Ass12 server is running");
});

app.listen(port, () => {
  console.log(`ass12 Server is running on prot: ${port}`);
});
