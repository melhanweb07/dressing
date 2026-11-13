export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  image: string;
  images: string[];
  description: string;
  sizes: string[];
  colors: string[];
  fabric: string;
  stock: number;
  featured?: boolean;
  isNew?: boolean;
};

export type CartItem = {
  product: Product;
  size: string;
  color: string;
  quantity: number;
};

export type Order = {
  id: string;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    notes?: string;
  };
  items: Array<{
    product: Pick<Product, "id" | "name" | "image"> & { price?: number };
    size: string;
    color: string;
    quantity: number;
    unitPrice?: number;
    total?: number;
  }>;
  subtotal: number;
  delivery: number;
  total: number;
  paymentStatus: "Pending" | "Payment Reported" | "Verified" | "Failed" | "Refunded";
  paymentMethod?: "gpay" | "cod";
  status: string;
};

export type Category = {
  id: string;
  name: string;
  image: string;
  visible: boolean;
};

export type StoreSettings = {
  shopName: string;
  contactNumber: string;
  whatsappNumber: string;
  gpayNumber: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  deliveryCharge: number;
  freeDeliveryThreshold: number;
  returnPolicy: string;
};
