const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  originalprice:{
    type: Number,
    required: true,
    min: 0,
  },
  
  totalStock: {
    type: Number,
    required: true,
    min: 0,
  },
  shortDescription: {
    type: String,
    required: true,
    trim: true,
    
  },
  longDescription: {
    type: String,
    required: true,
  },
  isTopSeller: {
    type: Boolean,
    default: false,
  },
  img:{
    type:String,
    required:true
  },
  category: {
    type: String,
    enum: ["dental", "stationary"],
    required: true,
  },
  information: {
    type: String,
   
  },
  hsnNo: {
    type: String,
    required: true,
    
  },

  SGST:{
    type:Number,
   required:true 
  },

  CGST:{
    type:Number,
    required:true
  }


}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
