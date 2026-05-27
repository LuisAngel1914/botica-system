# Sistema Multiplataforma para Gestión de Ventas e Inventario de Botica

Proyecto base listo para abrir en **Visual Studio Code**. Incluye:

- Backend con Node.js, Express, TypeScript y Prisma.
- Base de datos PostgreSQL mediante Prisma.
- Inventario por productos, lotes y vencimientos.
- Compras con ingreso automático de stock.
- Ventas con descuento automático de stock por lote más próximo a vencer.
- Caja: apertura, cierre y movimientos.
- Reportes básicos.
- Frontend React/Vite responsive.
- Preparado para futura integración con API externa.

---

## 1. Estructura del proyecto

```txt
botica-system-starter/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── prisma.config.ts
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    ├── .env.example
    ├── package.json
    ├── index.html
    └── vite.config.ts
```

---

## 2. Antes de empezar

Extrae el ZIP y abre la carpeta en Visual Studio Code.

Si ya tienes una carpeta llamada `D:\botica-system`, puedes extraer este proyecto en otra ruta o reemplazar tu carpeta actual después de hacer una copia de seguridad.

---

## 3. Levantar la base de datos local con Prisma

Abre una terminal dentro de Visual Studio Code y entra al backend:

```powershell
cd backend
npm install
```

Luego inicia la base de datos local:

```powershell
npx prisma dev
```

Deja esa terminal abierta. Verás algo parecido a:

```txt
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?..."
SHADOW_DATABASE_URL="postgres://postgres:postgres@localhost:51215/template1?..."
```

Este proyecto ya trae un `.env` configurado con esos puertos por defecto. Si Prisma te muestra otros puertos, copia los nuevos valores en `backend/.env`.

---

## 4. Crear tablas y datos iniciales

Abre otra terminal, también en `backend`:

```powershell
cd backend
npm run prisma:push
npm run prisma:generate
npm run seed
```

Esto creará:

- Roles: Administrador, Vendedor y Almacén.
- Categorías básicas.
- Laboratorios y proveedores de prueba.
- Usuario administrador inicial.

Credenciales iniciales:

```txt
Correo: admin@botica.com
Contraseña: 123456
```

---

## 5. Ejecutar el backend

En la terminal del backend:

```powershell
npm run dev
```

Debe abrirse en:

```txt
http://localhost:3000
```

Prueba también:

```txt
http://localhost:3000/api/health
```

---

## 6. Ejecutar el frontend

Abre otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

El frontend se abrirá normalmente en:

```txt
http://localhost:5173
```

Ingresa con:

```txt
admin@botica.com
123456
```

---

## 7. Prisma Studio

Para ver las tablas visualmente:

```powershell
cd backend
npm run studio
```

---

## 8. Comandos principales

### Backend

```powershell
cd backend
npm install
npx prisma dev
npm run prisma:push
npm run prisma:generate
npm run seed
npm run dev
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

---

## 9. Notas importantes

No ejecutes por ahora:

```powershell
npm audit fix --force
```

Puede actualizar dependencias con cambios incompatibles. Primero hagamos funcionar el sistema base.

---

## 10. Próximo paso sugerido

Cuando el proyecto ya funcione en tu máquina, el siguiente paso será:

1. Revisar que puedas iniciar sesión.
2. Crear productos.
3. Registrar una compra con lote y vencimiento.
4. Realizar una venta.
5. Verificar que el stock se descuente.
6. Luego preparar Railway y Render.
