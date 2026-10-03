import React, { useState } from "react";
import { View, ScrollView, Pressable, Image } from "react-native";
import {
  ShoppingCart,
  MagnifyingGlass,
  Plus,
  ArrowLeft,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Button,
  Field,
  Badge,
  IconButton,
  s,
} from "../../components/design/System";
import { useChild } from "../../context/ChildContext";
import { catalog, formatMoney } from "./catalog";
export function DaycareStoreScreen({ navigation }: any) {
  const { cart, cartItemCount, cartTotal, addToCart } = useChild();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const inCart = (id: number) =>
    cart.find((item) => item.product.id === id)?.quantity || 0;
  const filtered = catalog.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Page
      header={false}
      contentStyle={{ paddingHorizontal: 20 }}
      footer={
        cartItemCount > 0 ? (
          <View
            style={[
              s.between,
              {
                backgroundColor: "#0B2035",
                borderRadius: 30,
                padding: 10,
                paddingLeft: 18,
              },
            ]}
          >
            <View style={s.row}>
              <ShoppingCart size={23} color="white" />
              <View>
                <Text size={11} color="#B9C5D1">
                  {cartItemCount} items
                </Text>
                <Text size={15} weight="semibold" color="white">
                  {formatMoney(cartTotal)}
                </Text>
              </View>
            </View>
            <Button
              title="View Cart"
              variant="secondary"
              onPress={() => navigation.navigate("ShoppingCart")}
              style={{
                backgroundColor: "white",
                minHeight: 38,
                paddingVertical: 9,
              }}
            />
          </View>
        ) : undefined
      }
    >
      <View style={[s.between, { marginBottom: 16 }]}>
        <IconButton
          icon={ArrowLeft}
          label="Go back"
          onPress={() => navigation.goBack()}
        />
        <Text size={26} weight="bold" style={{ flex: 1 }}>
          Daycare Store
        </Text>
        <View>
          <IconButton
            icon={ShoppingCart}
            label="Shopping cart"
            onPress={() => navigation.navigate("ShoppingCart")}
          />
          {cartItemCount > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                borderRadius: 10,
                minWidth: 19,
                paddingHorizontal: 4,
                backgroundColor: "#C32D31",
              }}
            >
              <Text size={10} color="white" style={{ textAlign: "center" }}>
                {cartItemCount}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text color="#767E8A" style={{ marginBottom: 20 }}>
        Everyday essentials for little learners.
      </Text>
      <Field
        icon={MagnifyingGlass}
        placeholder="Search daycare items…"
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 26 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          "All",
          "Learning Materials",
          "Hygiene",
          "Art Supplies",
          "Clothing",
        ].map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: category === c }}
            aria-pressed={category === c}
            onPress={() => setCategory(c)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 15,
              borderRadius: 22,
              backgroundColor: category === c ? "#061224" : "#F0EEF0",
            }}
          >
            <Text size={13} color={category === c ? "white" : "#626976"}>
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text size={23} weight="semibold" style={{ marginBottom: 18 }}>
        {search || category !== "All" ? "Your essentials" : "Frequently Needed"}
      </Text>
      <View style={s.grid}>
        {filtered.map((p) => (
          <Card
            key={p.id}
            style={{ width: "48%", padding: 0, overflow: "hidden" }}
          >
            <View style={{ width: "100%", aspectRatio: 1 }}>
              <Image
                source={p.image}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              <View style={{ position: "absolute", top: 10, left: 8 }}>
                <Badge
                  title={
                    inCart(p.id) >= p.stock
                      ? "ALL IN CART"
                      : p.stock <= 3
                        ? "LOW STOCK"
                        : "IN STOCK"
                  }
                  tone={p.stock <= 3 ? "gold" : "green"}
                />
              </View>
            </View>
            <View style={{ padding: 13 }}>
              <Text
                size={14}
                weight="semibold"
                numberOfLines={2}
                style={{ minHeight: 42 }}
              >
                {p.name}
              </Text>
              <View style={s.between}>
                <Text size={14} weight="semibold" color="#516A8B">
                  {formatMoney(p.price)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Add " + p.name + " to cart"}
                  disabled={inCart(p.id) >= p.stock}
                  onPress={() =>
                    addToCart({
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      category: p.category,
                      stock_quantity: p.stock,
                      in_stock: true,
                    })
                  }
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    opacity: inCart(p.id) >= p.stock ? 0.35 : 1,
                    backgroundColor: "#DCE9FF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={21} color="#24476D" />
                </Pressable>
              </View>
            </View>
          </Card>
        ))}
      </View>
      {!filtered.length && (
        <Card>
          <Text color="#747D89">No items found. Try a different search.</Text>
        </Card>
      )}
    </Page>
  );
}
