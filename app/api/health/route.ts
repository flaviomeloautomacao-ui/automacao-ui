import { NextResponse } from "next/server";
import { getDatabaseErrorMessage } from "@/lib/databaseError";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: getDatabaseErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
