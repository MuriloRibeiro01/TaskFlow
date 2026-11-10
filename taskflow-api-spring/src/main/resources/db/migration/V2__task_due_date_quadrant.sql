-- Campos que o app já usa (prazo e quadrante da matriz de Eisenhower)
ALTER TABLE "tasks"
    ADD COLUMN "due_date" TIMESTAMP(3),
    ADD COLUMN "quadrant" TEXT CHECK ("quadrant" IN ('fazer_agora', 'agendar', 'delegar', 'eliminar'));
