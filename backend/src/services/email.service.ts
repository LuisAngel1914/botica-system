import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ================================
// BASE FUNCTION
// ================================
const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    return await resend.emails.send({
      from: "Botica L y L <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Error enviando correo:", error);
    throw error;
  }
};

// ================================
// 1. BIENVENIDA
// ================================
export const sendWelcomeEmail = async (to: string, name: string) => {
  return await sendEmail(
    to,
    "Bienvenido al sistema Botica L y L",
    `
    <div style="font-family: Arial;">
      <h2>👋 Bienvenido ${name}</h2>
      <p>Tu cuenta ha sido creada correctamente en el sistema de botica.</p>
      <p>Ya puedes iniciar sesión y gestionar productos, ventas e inventario.</p>
    </div>
    `
  );
};

// ================================
// 2. VENTA CONFIRMADA
// ================================
export const sendSaleEmail = async (to: string, data: any) => {
  return await sendEmail(
    to,
    "Venta confirmada",
    `
    <div style="font-family: Arial;">
      <h2>🧾 Venta registrada</h2>
      <p><b>Total:</b> S/ ${data.total}</p>
      <p><b>Método de pago:</b> ${data.paymentMethod || "No especificado"}</p>
      <p>Gracias por su compra.</p>
    </div>
    `
  );
};

// ================================
// 3. STOCK BAJO
// ================================
export const sendStockLowEmail = async (to: string, product: any) => {
  return await sendEmail(
    to,
    "⚠ Alerta de stock bajo",
    `
    <div style="font-family: Arial;">
      <h2>Producto con stock bajo</h2>
      <p><b>Producto:</b> ${product.name}</p>
      <p><b>Stock actual:</b> ${product.finalStock ?? product.stock}</p>
      <p>Se recomienda reabastecer el producto.</p>
    </div>
    `
  );
};

// ================================
// 4. RECUPERAR PASSWORD
// ================================
export const sendPasswordRecoveryEmail = async (to: string, link: string) => {
  return await sendEmail(
    to,
    "Recuperación de contraseña",
    `
    <div style="font-family: Arial;">
      <h2>🔐 Recuperar contraseña</h2>
      <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
      <a href="${link}">Restablecer contraseña</a>
    </div>
    `
  );
};

// ================================
// 5. CIERRE DE CAJA
// ================================
export const sendCashClosingEmail = async (to: string, data: any) => {
  return await sendEmail(
    to,
    `📊 Cierre de caja - ${data.date}`,
    `
    <div style="font-family: Arial;">
      <h2>Cierre de caja diario</h2>
      <p><b>Fecha:</b> ${data.date}</p>
      <p><b>Total ventas:</b> S/ ${data.totalSales}</p>
      <p><b>Ganancia:</b> S/ ${data.profit}</p>
      <p><b>Stock final:</b> ${data.stock}</p>
    </div>
    `
  );
};
