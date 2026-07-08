import React, { useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Hola 👋 Soy el asistente inteligente de Botica L y L.\n\nPuedo ayudarte con ventas, inventario, productos, stock y reportes.",
    },
  ]);

  const quickQuestions = [
    "📊 Ventas de hoy",
    "📦 Productos con bajo stock",
    "⏳ Productos por vencer",
    "💊 Recomendaciones",
  ];

  const sendMessage = async (customMessage?: string) => {
    const finalMessage = customMessage || message;

    if (!finalMessage.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: finalMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: finalMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Error en el servidor"
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            data.response ||
            data.message ||
            "No se obtuvo respuesta",
        },
      ]);

    } catch (error: any) {

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            "⚠️ Error del asistente:\n" +
            error.message,
        },
      ]);

    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="ai-floating-button"
        onClick={() => setOpen(!open)}
      >
        🤖
      </button>

      {open && (
        <div className="ai-chat-window">

          <div className="ai-header">

            <div>
              <h3>🤖 Asistente IA</h3>
              <span>● En línea</span>
            </div>

            <button
              onClick={() => setOpen(false)}
            >
              ×
            </button>

          </div>


          <div className="ai-body">

            {messages.map((msg, index) => (
              <div
                key={index}
                className={
                  msg.role === "user"
                    ? "ai-message user"
                    : "ai-message assistant"
                }
              >
                {msg.text}
              </div>
            ))}


            {loading && (
              <div className="ai-message assistant">
                Escribiendo...
              </div>
            )}

          </div>


          <div className="ai-shortcuts">

            {quickQuestions.map((q, index) => (
              <button
                key={index}
                onClick={() => sendMessage(q)}
              >
                {q}
              </button>
            ))}

          </div>


          <div className="ai-input">

            <input
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Escribe tu consulta..."
            />

            <button
              onClick={() => sendMessage()}
            >
              ➤
            </button>

          </div>

        </div>
      )}
    </>
  );
}