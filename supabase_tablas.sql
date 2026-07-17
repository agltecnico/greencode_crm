
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS delivery_notes CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS company_profile CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    "clientNumber" TEXT,
    name TEXT,
    "commercialName" TEXT,
    nif TEXT,
    address TEXT,
    city TEXT,
    "postalCode" TEXT,
    province TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    "defaultDiscount" NUMERIC,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    "productNumber" TEXT,
    name TEXT,
    description TEXT,
    price NUMERIC,
    tax NUMERIC,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    "orderNumber" TEXT,
    "clientId" TEXT REFERENCES clients(id),
    "clientName" TEXT,
    "clientCommercialName" TEXT,
    date TIMESTAMP WITH TIME ZONE,
    status TEXT,
    items JSONB,
    subtotal NUMERIC,
    "taxTotal" NUMERIC,
    total NUMERIC,
    "deliveredTo" TEXT,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE delivery_notes (
    id TEXT PRIMARY KEY,
    "deliveryNoteNumber" TEXT,
    "albaranNumber" TEXT,
    "orderId" TEXT REFERENCES orders(id),
    "clientId" TEXT REFERENCES clients(id),
    "clientName" TEXT,
    "clientCommercialName" TEXT,
    date TIMESTAMP WITH TIME ZONE,
    items JSONB,
    status TEXT,
    "deliveredTo" TEXT,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signature TEXT,
    sent BOOLEAN DEFAULT false
);

CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    "invoiceNumber" TEXT,
    type TEXT,
    "clientId" TEXT REFERENCES clients(id),
    "clientName" TEXT,
    "clientCommercialName" TEXT,
    "clientNif" TEXT,
    "clientAddress" TEXT,
    "clientCity" TEXT,
    "clientPostalCode" TEXT,
    "clientProvince" TEXT,
    date TIMESTAMP WITH TIME ZONE,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    status TEXT,
    items JSONB,
    subtotal NUMERIC,
    "ivaPercentage" NUMERIC,
    "taxTotal" NUMERIC,
    total NUMERIC,
    "paymentMethod" TEXT,
    "isPaid" BOOLEAN DEFAULT false,
    "deliveryNoteIds" JSONB,
    notes TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE expenses (
    id TEXT PRIMARY KEY,
    concept TEXT,
    amount NUMERIC,
    date TIMESTAMP WITH TIME ZONE,
    category TEXT,
    "isPaid" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE company_profile (
    id TEXT PRIMARY KEY,
    name TEXT,
    "commercialName" TEXT,
    nif TEXT,
    address TEXT,
    city TEXT,
    "postalCode" TEXT,
    province TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all clients" ON clients FOR ALL USING (true);
CREATE POLICY "public all products" ON products FOR ALL USING (true);
CREATE POLICY "public all orders" ON orders FOR ALL USING (true);
CREATE POLICY "public all delivery_notes" ON delivery_notes FOR ALL USING (true);
CREATE POLICY "public all invoices" ON invoices FOR ALL USING (true);
CREATE POLICY "public all expenses" ON expenses FOR ALL USING (true);
CREATE POLICY "public all company_profile" ON company_profile FOR ALL USING (true);
