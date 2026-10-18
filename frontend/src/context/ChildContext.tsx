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
  selectChild: (child: ChildSummary) => void;
  linkedChildren: ChildSummary[];
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

const getStoredChildId = (userId: number): number | null => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = window.localStorage.getItem(`ankelba_active_child_${userId}`);
      return val ? parseInt(val, 10) : null;
    }
  } catch {}
  return null;
};

const setStoredChildId = (userId: number, childId: number) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`ankelba_active_child_${userId}`, String(childId));
    }
  } catch {}
};

const clearStoredChildId = (userId: number) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`ankelba_active_child_${userId}`);
    }
  } catch {}
};

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [selectedChild, setSelectedChildState] = useState<ChildSummary | null>(
    DEFAULT_CHILD,
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const prevUserIdRef = React.useRef<number | null>(null);

  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    const currentUserId = user?.id ?? null;

    // Clear child & cart state when switching accounts
    if (prevUserId !== null && prevUserId !== currentUserId) {
      setCart([]);
      if (prevUserId) clearStoredChildId(prevUserId);
    }
    prevUserIdRef.current = currentUserId;

    if (user?.linked_children && user.linked_children.length > 0) {
      const storedId = getStoredChildId(user.id);
      const found = storedId ? user.linked_children.find((c) => c.id === storedId) : null;
      if (found) {
        setSelectedChildState(found);
      } else {
        setSelectedChildState(user.linked_children[0]);
        setStoredChildId(user.id, user.linked_children[0].id);
      }
    } else if (user) {
      setSelectedChildState(null);
    } else {
      setSelectedChildState(DEFAULT_CHILD);
      setCart([]);
    }
  }, [user]);

  const setSelectedChild = (child: ChildSummary) => {
    setSelectedChildState(child);
    if (user?.id) {
      setStoredChildId(user.id, child.id);
    }
  };

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
        selectChild: setSelectedChild,
        linkedChildren: user?.linked_children || [],
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
