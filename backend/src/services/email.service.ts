import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendCashClosingEmail = async (data: any) => {
  try {
    const response = await resend.emails.send({
      from: "Botica L y L <onboarding@resend.dev>",
      to: "admin@botica.com",
      subject: `Cierre de caja - ${data.date}`,
      html: `
        <h2>Cierre de caja diario</h2>
        <p><strong>Fecha:</strong> ${data.date}</p>
        <p><strong>Total ventas:</strong> S/ ${data.totalSales}</p>
        <p><strong>Ganancia:</strong> S/ ${data.profit}</p>
        <p><strong>Stock restante:</strong> ${data.stock}</p>
      `,
    });

    return response;
  } catch (error) {
    console.error("Error enviando email:", error);
    throw error;
  }
};
