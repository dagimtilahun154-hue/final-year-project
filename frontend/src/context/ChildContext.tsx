import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { ChildSummary, CartItem, Product } from "../types";
import { clampQuantity } from "../utils/cart";

interface ChildContextType {
  selectedChild: ChildSummary | null;
  setSelectedChild: (child: ChildSummary) => void;
  // Shopping Cart state
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemCount: number;
}

const DEFAULT_CHILD: ChildSummary = {
  id: 1,
  full_name: "Liya Hana",
  dob: "2022-05-12",
  gender: "female",
  enrollment_status: "active",
  relationship: "Mother",
  group_name: "Sunflower Group",
};

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState<ChildSummary | null>(
    DEFAULT_CHILD,
  );
  const [cart, setCart] = useState<CartItem[]>([
    // Pre-populated initial items matching Figma mock ("2 items, 300 ETB" / "Color Pencils + Exercise Book")
    {
      product: {
        id: 1,
        category_id: 2,
        name: "Color Pencils",
        description: "Set of 12 vibrant colored pencils for art and learning",
        price: 180,
        stock_quantity: 40,
        is_active: true,
      },
      quantity: 1,
    },
    {
      product: {
        id: 2,
        category_id: 2,
        name: "Exercise Book",
        description:
          "Standard lined workbook for daycare handwriting and drawings",
        price: 120,
        stock_quantity: 60,
        is_active: true,
      },
      quantity: 1,
    },
  ]);

  useEffect(() => {
    if (user?.linked_children && user.linked_children.length > 0) {
      setSelectedChild(user.linked_children[0]);
    } else if (!selectedChild) {
      setSelectedChild(DEFAULT_CHILD);
    }
  }, [user]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: clampQuantity(
                  item.quantity + quantity,
                  item.product.stock_quantity,
                  item.product.in_stock !== false,
                ),
              }
            : item,
        );
      }
      const allowed = clampQuantity(
        quantity,
        product.stock_quantity,
        product.in_stock !== false,
      );
      return allowed ? [...prev, { product, quantity: allowed }] : prev;
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: clampQuantity(
                quantity,
                item.product.stock_quantity,
                item.product.in_stock !== false,
              ),
            }
          : item,
      ),
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price =
      typeof item.product.price === "string"
        ? parseFloat(item.product.price)
        : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <ChildContext.Provider
      value={{
        selectedChild,
        setSelectedChild,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartItemCount,
      }}
    >
      {children}
    </ChildContext.Provider>
  );
};

export const useChild = (): ChildContextType => {
  const context = useContext(ChildContext);
  if (!context) {
    throw new Error("useChild must be used within a ChildProvider");
  }
  return context;
};
