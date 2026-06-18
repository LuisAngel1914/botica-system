import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendCashClosingEmail = async (data: any) => {
  try {
    const response = await resend.emails.send({
      from: "Botica L y L <onboarding@resend.dev>",
      to: data.email || "admin@botica.com",
      subject: `Cierre de caja - ${data.date}`,

      html: `
        <div style="font-family: Arial; padding: 20px;">
          <h2>Cierre de caja diario</h2>

          <p><strong>Fecha:</strong> ${data.date || "-"}</p>
          <p><strong>Total ventas:</strong> S/ ${data.totalSales || 0}</p>
          <p><strong>Ganancia:</strong> S/ ${data.profit || 0}</p>
          <p><strong>Stock restante:</strong> ${data.stock || 0}</p>

          <hr/>

          <p style="color: #666;">
            Reporte generado automáticamente por el sistema de botica.
          </p>
        </div>
      `,
    });

    return response;
  } catch (error) {
    console.error("Error enviando email:", error);
    throw error;
  }
};
