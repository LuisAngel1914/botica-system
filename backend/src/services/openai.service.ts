import OpenAI from "openai";


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

console.log(
    "OPENAI KEY:",
    process.env.OPENAI_API_KEY ? "CARGADA" : "NO EXISTE"
);


export const chatWithAI = async (message:string)=>{

    try{

        const completion = await openai.chat.completions.create({

            model:"gpt-4o-mini",

            messages:[

                {
                    role:"system",
                    content:
                    `
                    Eres el asistente inteligente del sistema Botica L y L.

                    Ayudas con:
                    - inventario
                    - productos
                    - ventas
                    - stock
                    - reportes

                    Responde de manera clara y profesional.
                    `
                },

                {
                    role:"user",
                    content:message
                }

            ],

            temperature:0.7

        });


        return completion.choices[0].message.content;


    }catch(error:any){

    console.error(
        "Error OpenAI:",
        error.message
    );

    throw error;
  }
}