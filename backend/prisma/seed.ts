import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en el archivo .env");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const roles = [
    { name: "Administrador", description: "Acceso total al sistema" },
    { name: "Vendedor", description: "Gestión de ventas y caja" },
    { name: "Almacén", description: "Gestión de productos e inventario" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Administrador" },
  });

  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@botica.com" },
    update: {
      roleId: adminRole.id,
      fullName: "Administrador del Sistema",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      roleId: adminRole.id,
      fullName: "Administrador del Sistema",
      email: "admin@botica.com",
      passwordHash,
      status: "ACTIVE",
    },
  });

  const categories = [
    "Analgésicos",
    "Antibióticos",
    "Antigripales",
    "Vitaminas",
    "Cuidado personal",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const labs = ["Genérico", "Medifarma", "Farmindustria"];

  for (const name of labs) {
    await prisma.laboratory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { name: "Proveedor General" },
  });

  if (!supplier) {
    await prisma.supplier.create({
      data: {
        name: "Proveedor General",
        phone: "999999999",
      },
    });
  }

  const analgesicos = await prisma.category.findUnique({
    where: { name: "Analgésicos" },
  });

  const generico = await prisma.laboratory.findUnique({
    where: { name: "Genérico" },
  });

  await prisma.product.upsert({
    where: { code: "MED-001" },
    update: {},
    create: {
      code: "MED-001",
      barcode: "775000000001",
      name: "Paracetamol 500mg",
      activeIngredient: "Paracetamol",
      presentation: "Tableta",
      categoryId: analgesicos?.id,
      laboratoryId: generico?.id,
      purchasePrice: 0.2,
      salePrice: 0.5,
      minStock: 20,
    },
  });

  console.log("Seed completado correctamente");
  console.log("Usuario: admin@botica.com");
  console.log("Contraseña: 123456");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });