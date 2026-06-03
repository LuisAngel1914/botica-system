import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
};

type Batch = {
  id: number;
  batchNumber: string;
  expirationDate: string;
  stock: number;
  purchasePrice: number | string;
  salePrice: number | string;
};

type Product = {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  activeIngredient?: string | null;
  presentation?: string | null;
  purchasePrice: number | string;
  salePrice: number | string;
  minStock: number;
  totalStock: number;
  batches?: Batch[];
};

type CartItem = {
  productId: number;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type SaleItem = {
  id: number;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  product: Product;
  batch?: Batch;
};

type Sale = {
  id: number;
  total: number | string;
  discount: number | string;
  paymentMethod: string;
  status: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  items: SaleItem[];
};

function formatDateOnly(dateString: string) {
  if (!dateString) return "";
  const cleanDate = dateString.split("T")[0];
  const [year, month, day] = cleanDate.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}

function formatPaymentMethod(method: string) {
  const labels: Record<string, string> = {
    CASH: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    MIXED: "Mixto",
  };

  return labels[method] || method;
}

function formatSaleStatus(status: string) {
  const labels: Record<string, string> = {
    COMPLETED: "Completado",
    CANCELLED: "Anulado",
  };

  return labels[status] || status;
}

function getDaysUntilExpiration(dateString: string) {
  const cleanDate = dateString.split("T")[0];
  const [year, month, day] = cleanDate.split("-").map(Number);

  if (!year || !month || !day) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(year, month - 1, day);
  expiration.setHours(0, 0, 0, 0);

  const difference = expiration.getTime() - today.getTime();
  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function getExpirationStatus(dateString: string) {
  const days = getDaysUntilExpiration(dateString);

  if (days < 0) {
    return { label: "Vencido", className: "expired", days };
  }

  if (days <= 30) {
    return { label: "Por vencer", className: "soon", days };
  }

  return { label: "Vigente", className: "valid", days };
}


type SectionKey = "panel" | "products" | "inventory" | "expirations" | "sales" | "reports" | "account";

const navItems: Array<{
  key: SectionKey;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: "panel",
    label: "Panel",
    description: "Vista general de la botica, métricas rápidas y accesos directos.",
    icon: "📊",
  },
  {
    key: "products",
    label: "Productos",
    description: "Registra medicamentos, precios, presentación y stock mínimo.",
    icon: "💊",
  },
  {
    key: "inventory",
    label: "Inventario",
    description: "Controla entradas de mercadería por lote y fecha de vencimiento.",
    icon: "📦",
  },
  {
    key: "expirations",
    label: "Vencimientos",
    description: "Supervisa lotes vencidos, próximos a vencer y vigentes.",
    icon: "⏳",
  },
  {
    key: "sales",
    label: "Ventas",
    description: "Registra ventas, administra el carrito y anula comprobantes si corresponde.",
    icon: "🧾",
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Consulta indicadores administrativos, alertas y productos más vendidos.",
    icon: "📈",
  },
  {
    key: "account",
    label: "Cuenta",
    description: "Administra tu acceso, cambia tu contraseña y revisa la seguridad de sesión.",
    icon: "🔐",
  },
];

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [email, setEmail] = useState("admin@botica.com");
  const [password, setPassword] = useState("123456");
  const [message, setMessage] = useState("");
  const [activeSection, setActiveSection] = useState<SectionKey>("panel");

  const [pharmacyName, setPharmacyName] = useState(
    localStorage.getItem("pharmacyName") || "Botica Pro"
  );
  const [pharmacySubtitle, setPharmacySubtitle] = useState(
    localStorage.getItem("pharmacySubtitle") || "Sistema de gestión"
  );
  const [pharmacyLogo, setPharmacyLogo] = useState(
    localStorage.getItem("pharmacyLogo") || "✚"
  );

  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockProducts, setStockProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleProductId, setSaleProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePaymentMethod, setSalePaymentMethod] = useState("CASH");
  const [saleDiscount, setSaleDiscount] = useState(0);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [productForm, setProductForm] = useState({
    code: "MED-002",
    barcode: "",
    name: "Ibuprofeno 400mg",
    activeIngredient: "Ibuprofeno",
    presentation: "Tableta",
    purchasePrice: 0.3,
    salePrice: 0.8,
    minStock: 10,
  });

  const [inventoryForm, setInventoryForm] = useState({
    productId: "",
    batchNumber: "LOTE-001",
    expirationDate: "2027-12-30",
    quantity: 100,
    unitCost: 0.3,
    salePrice: 0.8,
    invoiceNumber: "",
  });

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) => String(product.id) === inventoryForm.productId
    );
  }, [products, inventoryForm.productId]);

  const selectedSaleProduct = useMemo(() => {
    return products.find((product) => String(product.id) === saleProductId);
  }, [products, saleProductId]);

  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
    return Math.max(subtotal - Number(saleDiscount || 0), 0);
  }, [cart, saleDiscount]);

  const expirationRows = useMemo(() => {
    return stockProducts
      .flatMap((product) =>
        (product.batches || []).map((batch) => ({
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          minStock: product.minStock,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expirationDate: batch.expirationDate,
          stock: batch.stock,
          salePrice: batch.salePrice,
          status: getExpirationStatus(batch.expirationDate),
        }))
      )
      .sort((a, b) => a.status.days - b.status.days);
  }, [stockProducts]);

  const batchesExpired = expirationRows.filter((row) => row.status.className === "expired").length;
  const batchesSoon = expirationRows.filter((row) => row.status.className === "soon").length;

  const completedSales = useMemo(() => {
    return sales.filter((sale) => sale.status === "COMPLETED");
  }, [sales]);

  const cancelledSales = useMemo(() => {
    return sales.filter((sale) => sale.status === "CANCELLED");
  }, [sales]);

  const totalCompletedSales = useMemo(() => {
    return completedSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
  }, [completedSales]);

  const totalCancelledSales = useMemo(() => {
    return cancelledSales.reduce((acc, sale) => acc + Number(sale.total || 0), 0);
  }, [cancelledSales]);

  const totalStockUnits = useMemo(() => {
    return products.reduce((acc, product) => acc + Number(product.totalStock || 0), 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(
      (product) => Number(product.totalStock || 0) <= Number(product.minStock || 0)
    );
  }, [products]);

  const topProducts = useMemo(() => {
    const productMap = new Map<
      number,
      { productId: number; code: string; name: string; quantity: number; total: number }
    >();

    completedSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        const productId = item.product.id;
        const current = productMap.get(productId);
        const quantity = Number(item.quantity || 0);
        const subtotal = Number(item.subtotal || 0);

        if (current) {
          productMap.set(productId, {
            ...current,
            quantity: current.quantity + quantity,
            total: current.total + subtotal,
          });
        } else {
          productMap.set(productId, {
            productId,
            code: item.product.code,
            name: item.product.name,
            quantity,
            total: subtotal,
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [completedSales]);

  const paymentReport = useMemo(() => {
    const paymentMap = new Map<
      string,
      { method: string; count: number; total: number }
    >();

    completedSales.forEach((sale) => {
      const current = paymentMap.get(sale.paymentMethod);
      const total = Number(sale.total || 0);

      if (current) {
        paymentMap.set(sale.paymentMethod, {
          ...current,
          count: current.count + 1,
          total: current.total + total,
        });
      } else {
        paymentMap.set(sale.paymentMethod, {
          method: sale.paymentMethod,
          count: 1,
          total,
        });
      }
    });

    return Array.from(paymentMap.values()).sort((a, b) => b.total - a.total);
  }, [completedSales]);

  const currentSection =
    navItems.find((item) => item.key === activeSection) || navItems[0];
  function downloadCashClosingExcel() {
  const now = new Date();

  const formatDateTime = (value: Date) => {
    return value.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  const money = (value: number) => Number(value || 0).toFixed(2);

  const escapeHtml = (value: any) => {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  };

  const todayCompletedSales = completedSales.filter((sale) =>
    isToday(sale.createdAt)
  );

  const todayCancelledSales = cancelledSales.filter((sale) =>
    isToday(sale.createdAt)
  );

  const totalSoldToday = todayCompletedSales.reduce(
    (acc, sale) => acc + Number(sale.total || 0),
    0
  );

  const totalCancelledToday = todayCancelledSales.reduce(
    (acc, sale) => acc + Number(sale.total || 0),
    0
  );

  const profitEstimated = todayCompletedSales.reduce((saleAcc, sale) => {
    const saleProfit =
      sale.items?.reduce((itemAcc, item) => {
        const quantity = Number(item.quantity || 0);
        const salePrice = Number(item.unitPrice || 0);
        const purchasePrice = Number(
          item.batch?.purchasePrice ?? item.product.purchasePrice ?? 0
        );

        return itemAcc + (salePrice - purchasePrice) * quantity;
      }, 0) || 0;

    return saleAcc + saleProfit;
  }, 0);

  const paymentMap = new Map<string, { method: string; count: number; total: number }>();

  todayCompletedSales.forEach((sale) => {
    const current = paymentMap.get(sale.paymentMethod);
    const total = Number(sale.total || 0);

    if (current) {
      paymentMap.set(sale.paymentMethod, {
        ...current,
        count: current.count + 1,
        total: current.total + total,
      });
    } else {
      paymentMap.set(sale.paymentMethod, {
        method: sale.paymentMethod,
        count: 1,
        total,
      });
    }
  });

  const productMap = new Map<
    number,
    {
      code: string;
      name: string;
      quantity: number;
      total: number;
      profit: number;
    }
  >();

  todayCompletedSales.forEach((sale) => {
    sale.items?.forEach((item) => {
      const productId = item.product.id;
      const quantity = Number(item.quantity || 0);
      const subtotal = Number(item.subtotal || 0);
      const salePrice = Number(item.unitPrice || 0);
      const purchasePrice = Number(
        item.batch?.purchasePrice ?? item.product.purchasePrice ?? 0
      );
      const profit = (salePrice - purchasePrice) * quantity;
      const current = productMap.get(productId);

      if (current) {
        productMap.set(productId, {
          ...current,
          quantity: current.quantity + quantity,
          total: current.total + subtotal,
          profit: current.profit + profit,
        });
      } else {
        productMap.set(productId, {
          code: item.product.code,
          name: item.product.name,
          quantity,
          total: subtotal,
          profit,
        });
      }
    });
  });

  const paymentRows = Array.from(paymentMap.values())
    .sort((a, b) => b.total - a.total)
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(formatPaymentMethod(row.method))}</td>
          <td>${row.count}</td>
          <td>${money(row.total)}</td>
        </tr>
      `
    )
    .join("");

  const productRows = Array.from(productMap.values())
    .sort((a, b) => b.total - a.total)
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.code)}</td>
          <td>${escapeHtml(product.name)}</td>
          <td>${product.quantity}</td>
          <td>${money(product.total)}</td>
          <td>${money(product.profit)}</td>
        </tr>
      `
    )
    .join("");

  const saleRows = todayCompletedSales
    .map(
      (sale) => `
        <tr>
          <td>${sale.id}</td>
          <td>${escapeHtml(new Date(sale.createdAt).toLocaleString("es-PE"))}</td>
          <td>${escapeHtml(formatPaymentMethod(sale.paymentMethod))}</td>
          <td>${money(Number(sale.discount || 0))}</td>
          <td>${money(Number(sale.total || 0))}</td>
          <td>${escapeHtml(formatSaleStatus(sale.status))}</td>
        </tr>
      `
    )
    .join("");

  const stockRows = products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.code)}</td>
          <td>${escapeHtml(product.name)}</td>
          <td>${Number(product.totalStock || 0)}</td>
          <td>${Number(product.minStock || 0)}</td>
          <td>${money(Number(product.salePrice || 0))}</td>
        </tr>
      `
    )
    .join("");

  const fileDate = now.toISOString().slice(0, 10);

  const excelHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
          }
          h1 {
            color: #0f172a;
          }
          h2 {
            margin-top: 24px;
            color: #1d4ed8;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 18px;
          }
          th {
            background: #1d4ed8;
            color: white;
            font-weight: bold;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 8px;
            text-align: left;
          }
          .number {
            text-align: right;
          }
        </style>
      </head>
      <body>
        <h1>Cierre de caja diario - ${escapeHtml(pharmacyName)}</h1>

        <table>
          <tr><th>Concepto</th><th>Detalle</th></tr>
          <tr><td>Fecha del cierre</td><td>${escapeHtml(formatDateTime(now))}</td></tr>
          <tr><td>Usuario</td><td>${escapeHtml(user?.fullName || "Administrador")}</td></tr>
          <tr><td>Ventas completadas del día</td><td>${todayCompletedSales.length}</td></tr>
          <tr><td>Ventas anuladas del día</td><td>${todayCancelledSales.length}</td></tr>
          <tr><td>Total vendido del día</td><td>S/ ${money(totalSoldToday)}</td></tr>
          <tr><td>Total anulado del día</td><td>S/ ${money(totalCancelledToday)}</td></tr>
          <tr><td>Ganancia estimada del día</td><td>S/ ${money(profitEstimated)}</td></tr>
          <tr><td>Stock restante total</td><td>${totalStockUnits} unidades</td></tr>
          <tr><td>Productos en bajo stock</td><td>${lowStockProducts.length}</td></tr>
        </table>

        <h2>Ventas por método de pago</h2>
        <table>
          <tr>
            <th>Método</th>
            <th>Cantidad de ventas</th>
            <th>Total S/</th>
          </tr>
          ${
            paymentRows ||
            `<tr><td colspan="3">No hay ventas completadas hoy.</td></tr>`
          }
        </table>

        <h2>Productos vendidos hoy</h2>
        <table>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Cantidad vendida</th>
            <th>Total vendido S/</th>
            <th>Ganancia estimada S/</th>
          </tr>
          ${
            productRows ||
            `<tr><td colspan="5">No hay productos vendidos hoy.</td></tr>`
          }
        </table>

        <h2>Detalle de ventas completadas</h2>
        <table>
          <tr>
            <th>N° venta</th>
            <th>Fecha y hora</th>
            <th>Método de pago</th>
            <th>Descuento S/</th>
            <th>Total S/</th>
            <th>Estado</th>
          </tr>
          ${
            saleRows ||
            `<tr><td colspan="6">No hay ventas completadas hoy.</td></tr>`
          }
        </table>

        <h2>Stock restante actual</h2>
        <table>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Stock restante</th>
            <th>Stock mínimo</th>
            <th>Precio venta S/</th>
          </tr>
          ${stockRows || `<tr><td colspan="5">No hay productos registrados.</td></tr>`}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `cierre-caja-${fileDate}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  setMessage("Cierre de caja descargado correctamente");
}

  function updatePharmacyName(value: string) {
    setPharmacyName(value);
    localStorage.setItem("pharmacyName", value);
  }

  function updatePharmacySubtitle(value: string) {
    setPharmacySubtitle(value);
    localStorage.setItem("pharmacySubtitle", value);
  }

  function updatePharmacyLogo(value: string) {
    setPharmacyLogo(value);
    localStorage.setItem("pharmacyLogo", value);
  }

  function resetBrandSettings() {
    updatePharmacyName("Botica Pro");
    updatePharmacySubtitle("Sistema de gestión");
    updatePharmacyLogo("✚");
    setMessage("Personalización restablecida correctamente");
  }

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || "Error en la solicitud");
    }

    return data;
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Credenciales inválidas");
      }

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Sesión iniciada correctamente");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();

    try {
      if (!passwordForm.currentPassword.trim()) {
        throw new Error("Ingresa tu contraseña actual");
      }

      if (passwordForm.newPassword.length < 6) {
        throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("La confirmación no coincide con la nueva contraseña");
      }

      await api("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setMessage("Contraseña actualizada correctamente. En tu próximo ingreso usa la nueva contraseña.");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function loadData() {
    if (!token) return;

    try {
      const [dashboardData, productsData, stockData, salesData] =
        await Promise.all([
          api("/reports/dashboard"),
          api("/products"),
          api("/inventory/stock"),
          api("/sales"),
        ]);

      setDashboard(dashboardData);
      setProducts(productsData);
      setStockProducts(stockData);
      setSales(Array.isArray(salesData) ? salesData : []);

      if (!inventoryForm.productId && productsData.length > 0) {
        setInventoryForm((current) => ({
          ...current,
          productId: String(productsData[0].id),
        }));
      }

      if (!saleProductId) {
        const firstProductWithStock = productsData.find(
          (product: Product) => Number(product.totalStock) > 0
        );

        if (firstProductWithStock) {
          setSaleProductId(String(firstProductWithStock.id));
        }
      }
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function createProduct(event: React.FormEvent) {
    event.preventDefault();

    try {
      const newProduct = await api("/products", {
        method: "POST",
        body: JSON.stringify({
          code: productForm.code,
          barcode: productForm.barcode || null,
          name: productForm.name,
          activeIngredient: productForm.activeIngredient,
          presentation: productForm.presentation,
          purchasePrice: Number(productForm.purchasePrice),
          salePrice: Number(productForm.salePrice),
          minStock: Number(productForm.minStock),
        }),
      });

      setMessage("Producto registrado correctamente");

      setInventoryForm((current) => ({
        ...current,
        productId: String(newProduct.id),
        unitCost: Number(productForm.purchasePrice),
        salePrice: Number(productForm.salePrice),
      }));

      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function createInventoryEntry(event: React.FormEvent) {
    event.preventDefault();

    try {
      if (!inventoryForm.productId) {
        throw new Error("Selecciona un producto");
      }

      if (Number(inventoryForm.quantity) <= 0) {
        throw new Error("La cantidad debe ser mayor a 0");
      }

      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: null,
          invoiceNumber: inventoryForm.invoiceNumber || null,
          items: [
            {
              productId: Number(inventoryForm.productId),
              batchNumber: inventoryForm.batchNumber,
              expirationDate: inventoryForm.expirationDate,
              quantity: Number(inventoryForm.quantity),
              unitCost: Number(inventoryForm.unitCost),
              salePrice: Number(inventoryForm.salePrice),
            },
          ],
        }),
      });

      setMessage("Ingreso de inventario registrado correctamente");

      setInventoryForm((current) => ({
        ...current,
        batchNumber: `LOTE-${String(Date.now()).slice(-4)}`,
        quantity: 100,
        invoiceNumber: "",
      }));

      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function openCash() {
    try {
      await api("/cash/open", {
        method: "POST",
        body: JSON.stringify({ openingAmount: 0 }),
      });

      setMessage("Caja abierta correctamente");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function addToCart() {
    try {
      if (!selectedSaleProduct) {
        throw new Error("Selecciona un producto con stock");
      }

      const quantity = Number(saleQuantity);

      if (quantity <= 0) {
        throw new Error("La cantidad debe ser mayor a 0");
      }

      if (quantity > Number(selectedSaleProduct.totalStock)) {
        throw new Error("No hay stock suficiente");
      }

      const currentItem = cart.find(
        (item) => item.productId === selectedSaleProduct.id
      );

      const currentQuantity = currentItem?.quantity || 0;

      if (currentQuantity + quantity > Number(selectedSaleProduct.totalStock)) {
        throw new Error("La cantidad supera el stock disponible");
      }

      const unitPrice = Number(selectedSaleProduct.salePrice);
      const subtotal = quantity * unitPrice;

      if (currentItem) {
        setCart((items) =>
          items.map((item) =>
            item.productId === selectedSaleProduct.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  subtotal: item.subtotal + subtotal,
                }
              : item
          )
        );
      } else {
        setCart((items) => [
          ...items,
          {
            productId: selectedSaleProduct.id,
            code: selectedSaleProduct.code,
            name: selectedSaleProduct.name,
            quantity,
            unitPrice,
            subtotal,
          },
        ]);
      }

      setSaleQuantity(1);
      setMessage("Producto agregado al carrito");
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  function removeCartItem(productId: number) {
    setCart((items) => items.filter((item) => item.productId !== productId));
  }

  async function createSale() {
    try {
      if (cart.length === 0) {
        throw new Error("Agrega productos al carrito");
      }

      await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: salePaymentMethod,
          discount: Number(saleDiscount || 0),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      setMessage("Venta registrada correctamente");
      setCart([]);
      setSaleDiscount(0);
      setSaleQuantity(1);

      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  async function cancelSale(saleId: number) {
    const reason = window.prompt(
      "Ingresa el motivo de anulación de la venta. Ejemplo: Error de registro"
    );

    if (!reason) return;

    try {
      if (reason.trim().length < 3) {
        throw new Error("El motivo debe tener al menos 3 caracteres");
      }

      await api(`/sales/${saleId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });

      setMessage("Venta anulada correctamente. El stock fue devuelto al lote correspondiente");
      await loadData();
    } catch (error: any) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedProduct) {
      setInventoryForm((current) => ({
        ...current,
        unitCost: Number(selectedProduct.purchasePrice),
        salePrice: Number(selectedProduct.salePrice),
      }));
    }
  }, [selectedProduct]);

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>{pharmacyName}</h1>
          <p>{pharmacySubtitle}</p>

          <form onSubmit={login}>
            <label>Correo</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />

            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button>Ingresar</button>
          </form>

          {message && <div className="message">{message}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="app app-shell">
      <aside className="sidebar sidebar-modern">
        <div className="brand-card">
          <div className="brand-icon">{pharmacyLogo || "✚"}</div>
          <div>
            <h2>{pharmacyName || "Botica Pro"}</h2>
            <span>{pharmacySubtitle || "Sistema de gestión"}</span>
          </div>
        </div>

        <div className="user-card">
          <div className="avatar">{user?.fullName?.charAt(0) || "A"}</div>
          <div>
            <strong>{user?.fullName}</strong>
            <small>{user?.role}</small>
          </div>
        </div>

        <nav className="module-nav" aria-label="Menú principal">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeSection === item.key ? "nav-item active" : "nav-item"}
              onClick={() => setActiveSection(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="online-dot"></div>
          <span>Sistema activo</span>
        </div>

        <button onClick={logout} className="secondary logout-button">
          Cerrar sesión
        </button>
      </aside>

      <section className="content content-modern">
        <header className="topbar topbar-modern">
          <div>
            <div className="section-kicker">{currentSection.icon} Módulo activo</div>
            <h1>{currentSection.label}</h1>
            <p>{currentSection.description}</p>
          </div>

          <div className="topbar-actions">
            <button type="button" className="soft-button" onClick={loadData}>
              Actualizar
            </button>
            <button onClick={openCash}>Abrir caja</button>
          </div>
        </header>

        {message && <div className="message message-modern">{message}</div>}

        {activeSection === "panel" && (
          <>
        <section className="cards cards-modern">
          <article className="card">
            <span>Productos</span>
            <strong>{dashboard?.productsCount ?? 0}</strong>
          </article>

          <article className="card">
            <span>Ventas hoy</span>
            <strong>{dashboard?.salesCountToday ?? 0}</strong>
          </article>

          <article className="card">
            <span>Total hoy</span>
            <strong>
              S/ {Number(dashboard?.totalSalesToday ?? 0).toFixed(2)}
            </strong>
          </article>

          <article className="card">
            <span>Bajo stock</span>
            <strong>{dashboard?.lowStock?.length ?? 0}</strong>
          </article>
        </section>

        <section className="quick-actions panel">
          <div className="section-header">
            <div>
              <h2>Accesos rápidos</h2>
              <p className="muted">Ingresa directamente al módulo que necesitas gestionar.</p>
            </div>
          </div>
          <div className="quick-grid">
            {navItems
              .filter((item) => item.key !== "panel")
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="quick-card"
                  onClick={() => setActiveSection(item.key)}
                >
                  <span>{item.icon}</span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
          </div>
        </section>

        <section className="panel brand-settings-panel">
          <div className="section-header">
            <div>
              <h2>Personalización de la botica</h2>
              <p className="muted">
                Cambia el nombre, subtítulo e icono del sistema. Se guardará en este navegador.
              </p>
            </div>
            <button type="button" className="soft-button" onClick={resetBrandSettings}>
              Restablecer
            </button>
          </div>

          <div className="brand-settings-grid">
            <label>
              Nombre comercial
              <input
                value={pharmacyName}
                onChange={(e) => updatePharmacyName(e.target.value)}
                placeholder="Ejemplo: Botica L y L"
              />
            </label>

            <label>
              Subtítulo
              <input
                value={pharmacySubtitle}
                onChange={(e) => updatePharmacySubtitle(e.target.value)}
                placeholder="Ejemplo: Ventas e inventario"
              />
            </label>

            <label>
              Icono o iniciales
              <input
                value={pharmacyLogo}
                onChange={(e) => updatePharmacyLogo(e.target.value.slice(0, 3))}
                placeholder="Ejemplo: 💊 o L&L"
              />
            </label>
          </div>

          <div className="brand-preview-card">
            <div className="brand-icon preview-icon">{pharmacyLogo || "✚"}</div>
            <div>
              <strong>{pharmacyName || "Botica Pro"}</strong>
              <span>{pharmacySubtitle || "Sistema de gestión"}</span>
            </div>
          </div>
        </section>
          </>
        )}

        {activeSection === "reports" && (
        <section className="panel reports-section">
          <div className="section-header">
            <div>
              <h2>Reportes y resumen administrativo</h2>
              <p className="muted">
                Revisa ventas, stock, anulaciones y alertas principales de la botica en una sola vista.
              </p>
              <button type="button" onClick={downloadCashClosingExcel}>
                📥 Descargar cierre de caja Excel
              </button>
            </div>
          </div>

          <div className="report-cards">
            <article className="report-card">
              <span>Ventas completadas</span>
              <strong>{completedSales.length}</strong>
              <small>S/ {totalCompletedSales.toFixed(2)}</small>
            </article>

            <article className="report-card">
              <span>Ventas anuladas</span>
              <strong>{cancelledSales.length}</strong>
              <small>S/ {totalCancelledSales.toFixed(2)}</small>
            </article>

            <article className="report-card">
              <span>Stock total</span>
              <strong>{totalStockUnits}</strong>
              <small>unidades disponibles</small>
            </article>

            <article className="report-card">
              <span>Alertas</span>
              <strong>{lowStockProducts.length + batchesExpired + batchesSoon}</strong>
              <small>bajo stock / vencimiento</small>
            </article>
          </div>

          <div className="report-grid">
            <article className="report-box">
              <h3>Productos más vendidos</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td>
                          <strong>{product.name}</strong>
                          <div className="muted-small">{product.code}</div>
                        </td>
                        <td>{product.quantity}</td>
                        <td>S/ {product.total.toFixed(2)}</td>
                      </tr>
                    ))}

                    {topProducts.length === 0 && (
                      <tr>
                        <td colSpan={3}>Todavía no hay ventas completadas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="report-box">
              <h3>Ventas por método de pago</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th>Ventas</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paymentReport.map((row) => (
                      <tr key={row.method}>
                        <td>{formatPaymentMethod(row.method)}</td>
                        <td>{row.count}</td>
                        <td>S/ {row.total.toFixed(2)}</td>
                      </tr>
                    ))}

                    {paymentReport.length === 0 && (
                      <tr>
                        <td colSpan={3}>Todavía no hay ventas por método de pago.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="report-box">
              <h3>Alertas rápidas</h3>
              <div className="alert-list">
                <div className="alert-item danger-alert">
                  <strong>{batchesExpired}</strong>
                  <span>Lotes vencidos</span>
                </div>
                <div className="alert-item warning-alert">
                  <strong>{batchesSoon}</strong>
                  <span>Lotes por vencer</span>
                </div>
                <div className="alert-item info-alert">
                  <strong>{lowStockProducts.length}</strong>
                  <span>Productos con bajo stock</span>
                </div>
              </div>

              {lowStockProducts.length > 0 && (
                <div className="mini-list">
                  <h4>Bajo stock</h4>
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div key={product.id} className="mini-list-row">
                      <span>{product.name}</span>
                      <strong>{product.totalStock}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
        )}

        {activeSection === "products" && (
        <section className="grid">
          <article className="panel">
            <h2>Registrar producto</h2>

            <form onSubmit={createProduct} className="product-form">
              <input
                placeholder="Código"
                value={productForm.code}
                onChange={(e) =>
                  setProductForm({ ...productForm, code: e.target.value })
                }
              />

              <input
                placeholder="Código de barras"
                value={productForm.barcode}
                onChange={(e) =>
                  setProductForm({ ...productForm, barcode: e.target.value })
                }
              />

              <input
                placeholder="Nombre"
                value={productForm.name}
                onChange={(e) =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
              />

              <input
                placeholder="Principio activo"
                value={productForm.activeIngredient}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    activeIngredient: e.target.value,
                  })
                }
              />

              <input
                placeholder="Presentación"
                value={productForm.presentation}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    presentation: e.target.value,
                  })
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Precio compra"
                value={productForm.purchasePrice}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    purchasePrice: Number(e.target.value),
                  })
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Precio venta"
                value={productForm.salePrice}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    salePrice: Number(e.target.value),
                  })
                }
              />

              <input
                type="number"
                placeholder="Stock mínimo"
                value={productForm.minStock}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    minStock: Number(e.target.value),
                  })
                }
              />

              <button>Guardar producto</button>
            </form>
          </article>

          <article className="panel">
            <h2>Productos registrados</h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Stock</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.code}</td>
                      <td>{product.name}</td>
                      <td>S/ {Number(product.salePrice).toFixed(2)}</td>
                      <td>{product.totalStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        )}

        {activeSection === "inventory" && (
        <section className="grid inventory-section">
          <article className="panel">
            <h2>Ingreso de inventario por lote</h2>
            <p className="muted">
              Registra la mercadería que entra a la botica. Esto aumenta el stock
              del producto y guarda lote con fecha de vencimiento.
            </p>

            <form onSubmit={createInventoryEntry} className="product-form">
              <select
                value={inventoryForm.productId}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    productId: e.target.value,
                  })
                }
              >
                <option value="">Seleccionar producto</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} - {product.name}
                  </option>
                ))}
              </select>

              <input
                placeholder="Número de lote"
                value={inventoryForm.batchNumber}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    batchNumber: e.target.value,
                  })
                }
              />

              <label>Fecha de vencimiento</label>
              <input
                type="date"
                value={inventoryForm.expirationDate}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    expirationDate: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="Cantidad"
                value={inventoryForm.quantity}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    quantity: Number(e.target.value),
                  })
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Costo unitario"
                value={inventoryForm.unitCost}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    unitCost: Number(e.target.value),
                  })
                }
              />

              <input
                type="number"
                step="0.01"
                placeholder="Precio venta"
                value={inventoryForm.salePrice}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    salePrice: Number(e.target.value),
                  })
                }
              />

              <input
                placeholder="Número de factura o guía opcional"
                value={inventoryForm.invoiceNumber}
                onChange={(e) =>
                  setInventoryForm({
                    ...inventoryForm,
                    invoiceNumber: e.target.value,
                  })
                }
              />

              <button>Registrar ingreso</button>
            </form>
          </article>

          <article className="panel">
            <h2>Stock por lotes</h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th>Stock</th>
                    <th>Precio venta</th>
                  </tr>
                </thead>

                <tbody>
                  {stockProducts.flatMap((product) =>
                    (product.batches || []).map((batch) => (
                      <tr key={batch.id}>
                        <td>{product.name}</td>
                        <td>{batch.batchNumber}</td>
                        <td>{formatDateOnly(batch.expirationDate)}</td>
                        <td>
                          <span
                            className={
                              batch.stock <= product.minStock
                                ? "badge warning"
                                : "badge"
                            }
                          >
                            {batch.stock}
                          </span>
                        </td>
                        <td>S/ {Number(batch.salePrice).toFixed(2)}</td>
                      </tr>
                    ))
                  )}

                  {stockProducts.every(
                    (product) => !product.batches || product.batches.length === 0
                  ) && (
                    <tr>
                      <td colSpan={5}>Todavía no hay lotes registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        )}

        {activeSection === "expirations" && (
        <section className="panel expiration-section">
          <div className="section-header">
            <div>
              <h2>Control de vencimientos</h2>
              <p className="muted">
                Revisa los lotes vencidos, próximos a vencer y vigentes. Para una botica, este control ayuda a evitar pérdidas y ventas de productos vencidos.
              </p>
            </div>

            <div className="expiration-summary">
              <span className="summary-pill expired">Vencidos: {batchesExpired}</span>
              <span className="summary-pill soon">Por vencer: {batchesSoon}</span>
              <span className="summary-pill valid">Total lotes: {expirationRows.length}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th>Días</th>
                  <th>Stock</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {expirationRows.map((row) => (
                  <tr key={`${row.productId}-${row.batchId}`}>
                    <td>
                      <strong>{row.productName}</strong>
                      <div className="muted-small">{row.productCode}</div>
                    </td>
                    <td>{row.batchNumber}</td>
                    <td>{formatDateOnly(row.expirationDate)}</td>
                    <td>
                      {row.status.days < 0
                        ? `Venció hace ${Math.abs(row.status.days)} día(s)`
                        : `${row.status.days} día(s)`}
                    </td>
                    <td>{row.stock}</td>
                    <td>
                      <span className={`expiration-badge ${row.status.className}`}>
                        {row.status.label}
                      </span>
                    </td>
                  </tr>
                ))}

                {expirationRows.length === 0 && (
                  <tr>
                    <td colSpan={6}>Todavía no hay lotes para evaluar vencimientos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {activeSection === "sales" && (
        <section className="grid sales-section">
          <article className="panel">
            <h2>Registrar venta</h2>
            <p className="muted">
              Selecciona productos con stock, agrégalos al carrito y registra la
              venta. El sistema descontará el stock automáticamente.
            </p>

            <div className="product-form">
              <select
                value={saleProductId}
                onChange={(e) => setSaleProductId(e.target.value)}
              >
                <option value="">Seleccionar producto con stock</option>

                {products
                  .filter((product) => Number(product.totalStock) > 0)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.name} | Stock: {product.totalStock} | S/{" "}
                      {Number(product.salePrice).toFixed(2)}
                    </option>
                  ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Cantidad"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(Number(e.target.value))}
              />

              <button type="button" onClick={addToCart}>
                Agregar al carrito
              </button>

              <label>Método de pago</label>
              <select
                value={salePaymentMethod}
                onChange={(e) => setSalePaymentMethod(e.target.value)}
              >
                <option value="CASH">Efectivo</option>
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="MIXED">Mixto</option>
              </select>

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Descuento"
                value={saleDiscount}
                onChange={(e) => setSaleDiscount(Number(e.target.value))}
              />
            </div>

            <h3>Carrito</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>S/ {item.unitPrice.toFixed(2)}</td>
                      <td>S/ {item.subtotal.toFixed(2)}</td>
                      <td>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeCartItem(item.productId)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5}>Todavía no hay productos en el carrito.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="sale-total">Total: S/ {cartTotal.toFixed(2)}</div>

            <button type="button" onClick={createSale}>
              Registrar venta
            </button>
          </article>

          <article className="panel">
            <h2>Ventas recientes</h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.slice(0, 10).map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.id}</td>
                      <td>{new Date(sale.createdAt).toLocaleString()}</td>
                      <td>{formatPaymentMethod(sale.paymentMethod)}</td>
                      <td>S/ {Number(sale.total).toFixed(2)}</td>
                      <td>
                        <span
                          className={
                            sale.status === "CANCELLED"
                              ? "status-badge cancelled"
                              : "status-badge completed"
                          }
                          title={sale.cancelReason || ""}
                        >
                          {formatSaleStatus(sale.status)}
                        </span>
                      </td>
                      <td>
                        {sale.status === "CANCELLED" ? (
                          <span className="muted-small">Sin acción</span>
                        ) : (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => cancelSale(sale.id)}
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6}>Todavía no hay ventas registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        )}

        {activeSection === "account" && (
          <section className="grid account-section">
            <article className="panel account-panel">
              <div className="section-header">
                <div>
                  <h2>Configuración de cuenta</h2>
                  <p className="muted">
                    Cambia la contraseña del administrador para no depender de la clave inicial del sistema.
                  </p>
                </div>
                <span className="security-pill">Sesión protegida</span>
              </div>

              <div className="account-profile-card">
                <div className="avatar large-avatar">{user?.fullName?.charAt(0) || "A"}</div>
                <div>
                  <strong>{user?.fullName}</strong>
                  <span>{user?.email}</span>
                  <small>{user?.role}</small>
                </div>
              </div>

              <form onSubmit={changePassword} className="product-form account-form">
                <label>Contraseña actual</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  placeholder="Ingresa tu contraseña actual"
                />

                <label>Nueva contraseña</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="Mínimo 6 caracteres"
                />

                <label>Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Repite la nueva contraseña"
                />

                <button type="submit">Actualizar contraseña</button>
              </form>
            </article>

            <article className="panel security-panel">
              <h2>Buenas prácticas de seguridad</h2>
              <div className="security-list">
                <div className="security-item">
                  <span>✅</span>
                  <div>
                    <strong>Usa una contraseña propia</strong>
                    <p>No mantengas la contraseña inicial 123456 en producción.</p>
                  </div>
                </div>

                <div className="security-item">
                  <span>✅</span>
                  <div>
                    <strong>Cierra sesión al terminar</strong>
                    <p>Evita que otra persona use el sistema con tu usuario.</p>
                  </div>
                </div>

                <div className="security-item">
                  <span>✅</span>
                  <div>
                    <strong>Protege las variables de entorno</strong>
                    <p>No compartas tus claves, contraseñas ni variables privadas del sistema.</p>
                  </div>
                </div>

                <div className="security-item">
                  <span>✅</span>
                  <div>
                    <strong>Usa una clave fuerte</strong>
                    <p>Combina letras, números y símbolos para mayor seguridad.</p>
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
