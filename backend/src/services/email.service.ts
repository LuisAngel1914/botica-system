import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ================================
// BASE FUNCTION (MEJORADA)
// ================================
export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no configurada");
  }

  try {
    const response = await resend.emails.send({
      from: "Botica System <onboarding@resend.dev>", // OK para pruebas
      to: [to], // correcto (array obligatorio en Resend)
      subject,
      html,
    });

    console.log("📧 Email enviado correctamente:", {
      to,
      subject,
      id: response?.data?.id,
    });

    return response;
  } catch (error: any) {
    console.error("❌ Error enviando correo:", {
      to,
      subject,
      error: error?.message || error,
    });

    throw error;
  }
};

// ================================
// 1. BIENVENIDA
// ================================
export const sendWelcomeEmail = async (to: string, name: string) => {
  return sendEmail(
    to,
    "👋 Bienvenido al sistema Botica L y L",
    `
    <div style="font-family: Arial; padding: 12px;">
      <h2>👋 Bienvenido ${name}</h2>
      <p>Tu cuenta ha sido creada correctamente en el sistema.</p>
      <p>Ya puedes gestionar productos, ventas e inventario.</p>
    </div>
    `
  );
};

// ================================
// 2. VENTA CONFIRMADA
// ================================
export const sendSaleEmail = async (to: string, data: any) => {
  return sendEmail(
    to,
    "🧾 Venta confirmada",
    `
    <div style="font-family: Arial; padding: 12px;">
      <h2>Venta registrada</h2>
      <p><b>Total:</b> S/ ${data.total}</p>
      <p><b>Método de pago:</b> ${data.paymentMethod || "No especificado"}</p>
    </div>
    `
  );
};

// ================================
// 3. STOCK BAJO
// ================================
export const sendStockLowEmail = async (to: string, product: any) => {
  return sendEmail(
    to,
    "⚠ Stock bajo",
    `
    <div style="font-family: Arial; padding: 12px;">
      <h2>Alerta de stock bajo</h2>
      <p><b>Producto:</b> ${product.name}</p>
      <p><b>Stock actual:</b> ${product.finalStock ?? product.stock ?? 0}</p>
    </div>
    `
  );
};

// ================================
// 4. RECUPERAR PASSWORD
// ================================
export const sendPasswordRecoveryEmail = async (to: string, link: string) => {
  return sendEmail(
    to,
    "🔐 Recuperación de contraseña",
    `
    <div style="font-family: Arial; padding: 12px;">
      <h2>Recuperación de contraseña</h2>
      <p>Haz clic en el enlace para restablecer tu contraseña:</p>
      <a href="${link}">${link}</a>
    </div>
    `
  );
};

// ================================
// 5. CIERRE DE CAJA
// ================================
export const sendCashClosingEmail = async (to: string, data: any) => {
  return sendEmail(
    to,
    `📊 Cierre de caja - ${data.date}`,
    `
    <div style="font-family: Arial; padding: 12px;">
      <h2>Cierre de caja diario</h2>
      <p><b>Fecha:</b> ${data.date}</p>
      <p><b>Total ventas:</b> S/ ${data.totalSales}</p>
      <p><b>Ganancia:</b> S/ ${data.profit}</p>
      <p><b>Stock final:</b> ${data.stock}</p>
    </div>
    `
  );
};
export const sendExpirationEmail = async (
  to:string,
  products:any[]
)=>{

return sendEmail(

to,

"⏳ Productos próximos a vencer - Botica L y L",

`

<div style="font-family:Arial;padding:20px">

<h2>⏳ Productos próximos a vencer</h2>

<ul>

${
products.map(product=>`

<li>

<b>${product.product.name}</b>

<br/>

Lote:
${product.batchNumber}

<br/>

Fecha vencimiento:
${new Date(product.expirationDate)
.toLocaleDateString()}

</li>

<br/>

`).join("")
}

</ul>

</div>

`

);

};
// =====================================
// REPORTE ADMINISTRATIVO
// =====================================

export const sendDailyReportEmail = async (
  to: string,
  data: any
) => {

  return sendEmail(
    to,
    `📊 Reporte administrativo Botica L y L - ${data.date}`,
    `
    <div style="font-family:Arial;padding:20px">

      <h2>📊 Reporte administrativo</h2>

      <p>
      <b>Fecha:</b> ${data.date}
      </p>

      <hr/>

      <h3>💰 Ventas</h3>

      <p>
      Total vendido:
      <b>S/ ${data.totalSales}</b>
      </p>

      <p>
      Ventas anuladas:
      <b>S/ ${data.cancelledSales}</b>
      </p>


      <h3>📦 Inventario</h3>

      <p>
      Stock disponible:
      <b>${data.stock} unidades</b>
      </p>


      <h3>⚠ Alertas</h3>

      <p>
      Productos bajo stock:
      <b>${data.lowStock}</b>
      </p>


      <p>
      Productos próximos a vencer:
      <b>${data.expiring}</b>
      </p>


      <br/>

      <small>
      Reporte generado automáticamente por Botica L y L
      </small>

    </div>
    `
  );

};