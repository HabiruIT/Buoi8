var express = require("express");
var router = express.Router();
let { postUserValidator, validateResult } = require('../utils/validatorHandler')
let userController = require('../controllers/users')
let cartModel = require('../schemas/cart');
let { checkLogin, checkRole } = require('../utils/authHandler.js')
let { uploadExcel } = require('../utils/uploadHandler')
let { sendPasswordMail } = require('../utils/sendMailHandler')
let roleModel = require('../schemas/roles')
let excelJS = require('exceljs')
let path = require('path')
let fs = require('fs')
let crypto = require('crypto')

let userModel = require("../schemas/users");
const { default: mongoose } = require("mongoose");
//- Strong password

router.get("/", checkLogin,
  checkRole("ADMIN", "MODERATOR"), async function (req, res, next) {
    let users = await userModel
      .find({ isDeleted: false })
      .populate({
        'path': 'role',
        'select': "name"
      })
    res.send(users);
  });

router.get("/:id", checkLogin, async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/",  postUserValidator, validateResult,
  async function (req, res, next) {
    let session = await mongoose.startSession()
    let transaction = session.startTransaction()
    try {
      let newItem = await userController.CreateAnUser(
        req.body.username,
        req.body.password,
        req.body.email,
        req.body.role,
        session
      )
      let newCart = new cartModel({
        user: newItem._id
      })
      let result = await newCart.save({ session })
      result = await result.populate('user')
      session.commitTransaction();
      session.endSession()
      res.send(result)
    } catch (err) {
      session.abortTransaction()
      session.endSession()
      res.status(400).send({ message: err.message });
    }
  });

router.put("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findById(id);
    for (const key of Object.keys(req.body)) {
      updatedItem[key] = req.body[key];
    }
    await updatedItem.save();

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post("/import", uploadExcel.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send({ message: "Vui lòng upload file Excel" });
  }

  const pathFile = path.join(__dirname, '../uploads', req.file.filename);

  try {
    // Tìm role USER
    const userRole = await roleModel.findOne({ name: "USER" });
    if (!userRole) {
      fs.unlinkSync(pathFile);
      return res.status(400).send({ message: "Không tìm thấy role USER trong hệ thống" });
    }

    const workbook = new excelJS.Workbook();
    await workbook.xlsx.readFile(pathFile);
    const worksheet = workbook.worksheets[0];

    const result = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const usernameRaw = row.getCell(1).value;
      const emailRaw = row.getCell(2).value;
      const username = usernameRaw?.result ?? usernameRaw;
      const email = emailRaw?.result ?? emailRaw;

      if (!username || !email) {
        result.push({ row: i, success: false, message: "Username hoặc email bị trống" });
        continue;
      }

      // Random password 16 ký tự
      const password = crypto.randomBytes(8).toString('hex');

      try {
        const newUser = new userModel({
          username: username,
          password: password,
          email: email,
          role: userRole._id
        });
        await newUser.save();

        const newCart = new cartModel({ user: newUser._id });
        await newCart.save();

        let mailError = null;
        try {
          await sendPasswordMail(email, username, password);
          await new Promise(resolve => setTimeout(resolve, 30000));
        } catch (mailErr) {
          mailError = mailErr.message;
          console.error("Lỗi gửi mail cho", email, ":", mailErr.message);
        }

        result.push({ row: i, success: true, username, email, mailError });
      } catch (err) {
        result.push({ row: i, success: false, username, email, message: err.message });
      }
    }

    fs.unlinkSync(pathFile);
    res.send(result);
  } catch (err) {
    if (fs.existsSync(pathFile)) fs.unlinkSync(pathFile);
    res.status(500).send({ message: err.message });
  }
});

module.exports = router;