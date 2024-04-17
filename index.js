const fs= require("fs");
const express=require("express");
const app=express();
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const multer=require("multer");
const path=require("path");
const cors=require("cors");

const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT;

app.use(express.json());
app.use(cors());

//Database Connection With Mongoose
mongoose.connect(process.env.DB_URL)

//API creation

app.get("/",(req,res)=>{
    res.send("Hello World!")
})

// IMAGE STORAGE ENGINE 
const storage=multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload=multer({storage:storage})

//creating upload endpoint for images
app.use('/images',express.static('upload/images'));

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:true,
        image_url:`https://mern-ecommerce-2-t80r.onrender.com/images/${req.file.filename}`
    })
})

//Schema for creating products
const Product=mongoose.model("Product",{
    id:{
        type:Number,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    image:{
        type:String,
        required:true
    },
    category:{
        type:String,
        required:true
    },
    new_price:{
        type:Number,
        required:true
    },
    old_price:{
        type:Number,
        required:true
    },
    date:{
        type:Date,
        default:Date.now
    },
    available:{
        type:Boolean,
        default:true
    }
})

app.post('/addproduct',async(req,res)=>{
    let products=await Product.find();
    
    let id=1;
    if(products.length>0)
       id=products[products.length-1].id+1;

    const product=new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price
    });

    await product.save();

    res.json({
        success:true,
        name:req.body.name
    })
})

//cretaing api for removing products
app.post('/removeproduct', async (req, res) => {
    const product = await Product.findOneAndDelete({ id: req.body.id });
    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const imageUrl = product.image;
    const imageUrlParts = new URL(imageUrl);
    const imageName = path.basename(imageUrlParts.pathname);

    fs.unlink(`./upload/images/${imageName}`, (err) => {
        if (err) {
            console.error("Error deleting file:", err);
        }
    });

    res.json({
        success:true,
        name:req.body.name
    })});


// creating api for getting all products
app.get('/allproducts',async(req,res)=>{
    let products=await Product.find();
    res.send(products)
})


//Schema for user model
const Users=mongoose.model('Users',{
    name:{
        type:String
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    cartData:{
        type:Object
    },
    date:{
        type:Date,
        default:Date.now
    },
    isAdmin:{
        type:Boolean,
        default:false
    }

})


//Creating Endpoint for registering the use

app.post('/signup',async(req,res)=>{
    let check=await Users.findOne({email:req.body.email});

    if(check) {
        return res.status(400).json({success:false,errors:"user already exist"})
    }
    let cart={};
    for(let i=0;i<300;i++){
        cart[i]=0;
    }
    const user=new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart   
    })

    await user.save()

    const data={
        user:{
            id:user.id
        }
    }

    const token=jwt.sign(data,process.env.sec_key)
    res.json({success:true,token})
})


//creating endpoint for user login
app.post("/login",async(req,res)=>{
    let user=await Users.findOne({email:req.body.email});
    console.log(user)
    if(user){
        const pass=req.body.password===user.password;
        if(pass){
            const data={
                user:{
                    id:user.id
                }
            }
            const token=jwt.sign(data,process.env.sec_key)
            res.json({success:true,token})
        } else{
            res.json({success:false,errors:"user not exist with this combination"})
        }
    } else{
        res.json({success:false,errors:"user not exist with this combination"})
    }
})

//creating endpoint for newcollection data
app.get('/newcollections',async(req,res)=>{
    let products=await Product.find();
    let newcollection=products.slice(1).slice(-8);
    res.send(newcollection);
})


//creating endpoint for newcollection data
app.get('/popularinwomen',async(req,res)=>{
    let products=await Product.find({category:"women"});
    let popularinwomen=products.slice(0).slice(-4);
    res.send(popularinwomen);
})

//creating middleware to fetch user
const fetchUser=async(req,res,next)=>{
    const token=req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"please authenticate using valid token"})
    }
    else{
        try{
            const  data= jwt.verify(token,process.env.sec_key);
            req.user=data.user;
            next();
        }catch(error){
            res.status(401).send({errors:"please authenticate using valid token"})
        }
    }
}

//creating endpoint for add products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
       let userData=await Users.findOne({_id:req.user.id});
       userData.cartData[req.body.itemId]+=1;
       await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
       res.send("Added")

})

//creating endpoint for remove products in cartdata
app.post('/removefromcart',fetchUser,async(req,res)=>{
    let userData=await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId]-=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed")
})

//creating endpoint to get cartdata

app.post('/getcart',fetchUser,async(req,res)=>{
    let userData=await Users.findOne({_id:req.user.id});
    if(userData)
    res.json(userData.cartData);
})


app.get('/admin',fetchUser,async(req,res)=>{
    let user=await Users.findOne({_id:req.user.id});
    if(user)
    res.json(user.isAdmin);
})



app.listen(port,()=>{
    console.log("server is running on port "+port);
})
