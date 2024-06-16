const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddlv3rx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();

    const usersCollection = client.db("assetEachDB").collection("users");
    const paymentCollection = client.db("assetEachDB").collection("payments");
    const teamCollection = client.db("assetEachDB").collection("teams");
    const assetsCollection = client.db("assetEachDB").collection("assets");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    const verifyToken = (req, res, next) => {
      console.log(req, headers);
      next();
    };
    app.verifyHrManager = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isManager = user?.role === "hr";
      if (!isManager) {
        return res.status(403).send({
          message: "forbidden access",
        });
      }
      next();
    };
    app.get("/users/:email", async (req, res) => {
      const userEmail = req.params.email;
      const result = await usersCollection.findOne({ email: userEmail });
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const { status } = req.query;
      const filters = {};
      if (status) {
        filters.status = status;
      }
      const result = await usersCollection.find(filters).toArray();

      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const users = req.body;
      const query = { email: users.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "user already exists",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(users);
      res.send(result);
    });
    app.put("/status_update/:id", async (req, res) => {
      const userId = req.params.id;
      const { owner } = req.body;
      console.log(owner);
      if (!ObjectId.isValid(userId)) {
        return res.status(400).send({
          message: "Invalid user Id",
        });
      }
      const result = await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: "accepted",
            owner: owner,
          },
        }
      );

      res.send(result);
    });
    app.delete("/reject_request/:id", async (req, res) => {
      const userId = req.params.id;
      if (!ObjectId.isValid(userId)) {
        return res.status(400).send({
          message: "Invalid user Id",
        });
      }
      const result = await usersCollection.findOneAndDelete({
        _id: new ObjectId(userId),
      });

      res.send(result);
    });
    // team functions
    app.get("/teams", async (req, res) => {
      const { status } = req.query;
      const filters = {};
      if (status) {
        filters.status = status;
      }
      const result = await teamCollection.find(filters).toArray();

      res.send(result);
    });

    app.post("/teams", async (req, res) => {
      const { status } = req.query;
      const filters = {};
      if (status) {
        filters.status = status;
      }
      const result = await teamCollection.find(filters).toArray();

      res.send(result);
    });
    // assets functions

    app.get("/assets/productTypes", async (req, res) => {
      const result = await assetsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              uniqueProductTypes: { $addToSet: "$productType" },
            },
          },
          {
            $project: {
              _id: 0,
              uniqueProductTypes: 1,
            },
          },
        ])
        .toArray();

      const uniqueProductTypes =
        result.length > 0 ? result[0].uniqueProductTypes : [];

      res.send(uniqueProductTypes);
    });

    app.get("/assets", async (req, res) => {
      const { productType, searchTerm } = req.query;
      const filters = {};
      if (productType) {
        filters.productType = productType;
      }

      if (searchTerm) {
        filters.productName = { $regex: searchTerm, $options: "i" };
      }

      const result = await assetsCollection.find(filters).toArray();

      res.send(result);
    });
    app.post("/assets", async (req, res) => {
      const assetsBody = req.body;
      const result = await assetsCollection.insertOne(assetsBody);

      res.send(result);
    });

    app.put("/assets/:id", async (req, res) => {
      const userId = req.params.id;
      console.log(userId);
      if (!ObjectId.isValid(userId)) {
        return res.status(400).send({
          message: "Invalid user Id",
        });
      }
      const result = await assetsCollection.findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            status: "approved",
          },
        }
      );

      res.send(result);
    });

    app.delete("/assets/:id", async (req, res) => {
      const userId = req.params.id;
      if (!ObjectId.isValid(userId)) {
        return res.status(400).send({
          message: "Invalid user Id",
        });
      }
      const result = await assetsCollection.findOneAndDelete({
        _id: new ObjectId(userId),
      });

      res.send(result);
    });

    app.put("/assets/request/:id", async (req, res) => {
      const assetId = req.params.id;
      if (!ObjectId.isValid(assetId)) {
        return res.status(400).send({ message: "Invalid asset ID" });
      }

      const result = await assetsCollection.findOneAndUpdate(
        { _id: new ObjectId(assetId) },
        { $set: { requestStatus: "pending" } }
      );

      res.send(result);
    });

    app.put("/assets/cancel/:id", async (req, res) => {
      const assetId = req.params.id;
      if (!ObjectId.isValid(assetId)) {
        return res.status(400).send({ message: "Invalid asset ID" });
      }

      const result = await assetsCollection.findOneAndUpdate(
        { _id: new ObjectId(assetId), requestStatus: "pending" },
        { $set: { requestStatus: "cancelled" } }
      );

      res.send(result);
    });

    app.put("/assets/return/:id", async (req, res) => {
      const assetId = req.params.id;
      if (!ObjectId.isValid(assetId)) {
        return res.status(400).send({ message: "Invalid asset ID" });
      }

      const result = await assetsCollection.findOneAndUpdate(
        {
          _id: new ObjectId(assetId),
          requestStatus: "approved",
          assetType: "returnable",
        },
        { $set: { requestStatus: "returned" } }
      );

      // Optionally increment quantity (if your schema supports it)
      await assetsCollection.updateOne(
        { _id: new ObjectId(assetId) },
        { $inc: { quantity: 1 } }
      );

      res.send(result);
    });

    // my employee list
    app.get("/my_employees/:email", async (req, res) => {
      const myEmail = req.params.email;
      const filters = {};
      if (myEmail) {
        filters.owner = myEmail;
      }
      const result = await usersCollection.find(filters).toArray();

      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount in site the menu");
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log("payment info", payment);

      res.send({ paymentResult });
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // payment method system under the api

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
  res.send("asset is running");
});
app.listen(port, () => {
  console.log(`Asset Each is running on port ${port}`);
});
