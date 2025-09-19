// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Core dependencies
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("./config/passportConfig");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const morgan = require("morgan");
const moment = require("moment");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const serverless = require("serverless-http");
const ejsMate = require("ejs-mate");
const { SitemapStream, streamToPromise } = require("sitemap");
const { Readable } = require("stream");

const app = express();

// Wrap app for serverless deployment (Vercel, Netlify, etc.)
module.exports.handler = serverless(app);

// 🟢 1. CONNECT TO DATABASE
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Database connection failed", err));

// 🟢 2. SESSION CONFIGURATION
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "pakagepayment",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: "sessions",
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  },
};

app.use(session(sessionConfig));

// 🟢 3. MIDDLEWARE SETUP
app.use(morgan(":method :url :status :response-time ms - [:date]"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(methodOverride("_method"));
app.use(passport.initialize());
app.use(passport.session());

const sanitize = require("express-mongo-sanitize").sanitize;

// Middleware wrapper
app.use((req, res, next) => {
  req.body = sanitize(req.body, { replaceWith: "_" });
  req.params = sanitize(req.params, { replaceWith: "_" });
  req.safeQuery = sanitize({ ...req.query }, { replaceWith: "_" });
  next();
});

// 🟢 4. STATIC FILES
app.use(express.static(path.join(__dirname, "../public")));
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist"))
);

// 🟢 5. VIEW ENGINE + LAYOUTS
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 🟢 6. GLOBAL VARIABLES
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.moment = moment;
  res.locals.currentPage = req.originalUrl;
  res.locals.fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  res.locals.success = req.flash("success") || [];
  res.locals.error = req.flash("error") || [];
  res.locals.info = req.flash("info") || [];
  res.locals.warning = req.flash("warning") || [];
  if (req.session) {
    req.session.previousUrl = req.session.currentUrl || req.headers.referer;
    req.session.currentUrl = req.originalUrl;
  }
  res.locals.previousUrl = req.session?.previousUrl || "/";
  next();
});

// 🟢 7. SITEMAP GENERATION
// Base hostname for sitemap with fallback
const hostname =
  process.env.HOSTNAME && /^https?:\/\//.test(process.env.HOSTNAME)
    ? process.env.HOSTNAME
    : "http://galaxyfnc.xyz"; // Fallback for local development

// Static URLs for the sitemap
const staticUrls = [
  { url: "/", changefreq: "daily", priority: 1.0 },
  { url: "/home", changefreq: "daily", priority: 1.0 },
  // Add other static routes as needed (e.g., /auth/login, /user/profile)
];

// Cache for sitemap
let sitemapCache = null;

app.get("/sitemap.xml", async (req, res) => {
  try {
    // Serve from cache if available
    if (sitemapCache) {
      res.header("Content-Type", "application/xml");
      res.send(sitemapCache);
      return;
    }

    // Validate hostname
    try {
      new URL(hostname);
    } catch (error) {
      console.error("Invalid hostname for sitemap:", hostname);
      throw new Error("Invalid hostname configuration");
    }

    // Create sitemap stream with static URLs only
    const stream = new SitemapStream({ hostname });
    const data = await streamToPromise(Readable.from(staticUrls).pipe(stream));

    // Cache and serve
    sitemapCache = data.toString();
    res.header("Content-Type", "application/xml");
    res.send(sitemapCache);
  } catch (error) {
    console.error("Error generating sitemap:", error.message, error.stack);
    res.status(500).send("Error generating sitemap");
  }
});

// 🟢 8. ROUTES
app.get("/home", (req, res) => {
  res.render("user/home");
});

app.get("/", (req, res) => {
  res.redirect("/home");
});

app.get("/back", (req, res) => {
  res.redirect(req.session.previousUrl || "/");
});

app.use("/admin", require("./routes/admin/index.js"));
app.use("/creator", require("./routes/creator/index.js"));
app.use("/auth", require("./routes/auth"));
app.use("/user", require("./routes/user/index.js"));
app.use("/sendmail", require("./routes/email"));
app.use("/", require("./routes/createLink"));
app.use("/", require("./routes/viewLink.js"));
app.use("/", require("./routes/contact.js"));

// 🟢 9. 404 HANDLER
app.all(/.*/, (req, res, next) => {
  const err = new Error("Page not found");
  err.status = 404;
  console.log(err);
  next(err);
});

// 🟢 10. Ensure async rendering
app.use((req, res, next) => {
  const _render = res.render;
  res.render = function (view, options = {}, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    options = Object.assign({}, options, { async: true });
    return _render.call(this, view, options, callback);
  };
  next();
});

// 🟢 11. ERROR HANDLER
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const errorMessages = {
    404: "Oops! The page you’re looking for doesn’t exist.",
    500: "Something went wrong on our side. Please try again later.",
    501: "This feature is not implemented yet.",
  };
  const message =
    errorMessages[status] || "Unexpected error occurred. Please try again.";
  console.log(err);
  res.status(status).render("error/errorPage", {
    status,
    message,
    fullUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    previousUrl: res.locals.previousUrl || "/",
  });
});

// 🟢 12. LOCAL SERVER ONLY
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally at http://localhost:${PORT}`);
    console.log(`Sitemap available at http://localhost:${PORT}/sitemap.xml`);
  });
}

// 🟢 13. EXPORT FOR VERCEL
module.exports = app;
