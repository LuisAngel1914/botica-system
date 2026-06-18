import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// --------------------
// FUNCION BASE
// --------------------
const sendEmail = async (to: string, subject: string, html: string) => {
  return await resend.emails.send({
    from: "Botica L y L <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
};

// --------------------
// 1. BIENVENIDA
// --------------------
export const sendWelcomeEmail = async (to: string, name: string) => {
  return await sendEmail(
    to,
    "Bienvenido al sistema Botica L y L",
    `<h2>Bienvenido ${name}</h2>`
  );
};

// --------------------
// 2. VENTA CONFIRMADA
// --------------------
export const sendSaleEmail = async (to: string, data: any) => {
  return await sendEmail(
    to,
    "Venta confirmada",
    `<p>Total: S/ ${data.total}</p>`
  );
};

// --------------------
// 3. STOCK BAJO
// --------------------
export const sendStockLowEmail = async (to: string, product: any) => {
  return await sendEmail(
    to,
    "Stock bajo",
    `<p>${product.name} tiene stock bajo</p>`
  );
};

// --------------------
// 4. RECUPERAR PASSWORD
// --------------------
export const sendPasswordRecoveryEmail = async (to: string, link: string) => {
  return await sendEmail(
    to,
    "Recuperar contraseña",
    `<a href="${link}">Restablecer contraseña</a>`
  );
};

// --------------------
// 5. CIERRE DE CAJA
// --------------------
export const sendCashClosingEmail = async (to: string, data: any) => {
  return await sendEmail(
    to,
    `Cierre de caja - ${data.date}`,
    `<p>Total ventas: S/ ${data.totalSales}</p>`
  );
};
