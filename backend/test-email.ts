import "dotenv/config";
import { sendWelcomeEmail } from "./src/services/email.service";

async function test() {

  console.log("Iniciando prueba de correo...");

  try {

    const result = await sendWelcomeEmail(
      process.env.ADMIN_EMAIL || "luisangelauquisinche@gmail.com",
      "Administrador"
    );

    console.log("Correo enviado correctamente");
    console.log(result);

  } catch(error:any) {

    console.error("Error:", error.message);

  }

}

test();