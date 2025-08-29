if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("./config/passportConfig");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const morgan = require("morgan");
const moment = require("moment");
const ejsMate = require("ejs-mate");
const appError = require("./utils/appError.js");
const expressLayouts = require("express-ejs-layouts");

const app = express();
// 🟢 1. CONNECT TO DATABASE
mongoose
  .connect(process.env.MONGO_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Database con  nection failed", err));

// 🟢 2. SESSION CONFIGURATION
const sessionConfig = {
  secret: "pakagepayment",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_CONNECT,
    collectionName: "sessions",
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
};

// 🟢 3. MIDDLEWARE SETUP
app.use(morgan(":method :url :status :response-time ms - [:date]"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(flash());
app.use(methodOverride("_method"));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "../public")));
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist"))
);

// 🟢 4. VIEW ENGINE SETUP
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout/boilerplate");

// 🟢 5. GLOBAL VARIABLES
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.info = req.flash("info");
  res.warning = req.flash("warning");
  res.locals.currentPage = req.originalUrl;
  res.locals.fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  res.locals.moment = moment;

  if (req.session) {
    req.session.previousUrl = req.session.currentUrl || req.headers.referer;
    req.session.currentUrl = req.originalUrl;
  }

  res.locals.previousUrl = req.session?.previousUrl || "/";
  next();
});

app.use("/admin", require("./routes/admin/index.js"));
app.use("/creator", require("./routes/creator/index.js"));
app.use("/auth", require("./routes/auth"));
app.use("/user", require("./routes/user/index.js"));
app.use("/", require("./routes/createLink"));

app.get("/", (req, res) => {
  res.redirect("/user/payments");
});

// 🟢 8. BACK BUTTON SUPPORT
app.get("/back", (req, res) => {
  res.redirect(req.session.previousUrl || "/");
});

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(err.status || 500).render("error/errorPage", { err });
});

// 🟢 10. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
