import { Router } from "express";
import { chatWithAI } from "../services/openai.service";

const router = Router();


router.post("/", async (req,res)=>{

    try{

        const {message}=req.body;


        if(!message){
            return res.status(400).json({
                error:"Mensaje requerido"
            });
        }


        const response = await chatWithAI(message);


        res.json({
            success:true,
            response
        });


    }catch(error:any){

    console.error(error);

        res.status(500).json({
            success:false,
            message:
            error.message || "Error procesando chatbot"
        });
    }
});


export default router;