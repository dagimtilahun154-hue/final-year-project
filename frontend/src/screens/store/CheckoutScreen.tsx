import React, { useState } from "react";
import { View, Pressable } from "react-native";
import {
  Storefront,
  DeviceMobile,
  Lock,
  CheckCircle,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Field,
  Button,
  Notice,
  s,
} from "../../components/design/System";
import { useChild } from "../../context/ChildContext";
import { useDesign } from "../../context/DesignContext";
import { artwork } from "../../theme/assets";
import { formatMoney } from "./catalog";
export function CheckoutScreen({ navigation }: any) {
  const { cart, cartTotal, clearCart } = useChild();
  const { setOrder } = useDesign();
  const [method, setMethod] = useState<"pay_at_daycare" | "digital">(
    "pay_at_daycare",
  );
  const [note, setNote] = useState("");
  const place = () => {
    if (!cart.length) return;
    const reference = "PREVIEW-" + Date.now().toString().slice(-6);
    setOrder({
      reference,
      total: cartTotal,
      method,
      note,
      items: cart.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        price: Number(i.product.price),
      })),
    });
    clearCart();
    navigation.replace("OrderConfirmation", {
      orderRef: reference,
      totalAmount: cartTotal,
    });
  };
  return (
    <Page
      title="Checkout"
      subtitle="Review your items and payment preference."
      back
      tabs
      activeTab="Profile"
    >
      <Card style={{ marginBottom: 24 }}>
        <View style={s.row}>
          <Avatar source={artwork.guardianChild} size={62} />
          <View>
            <Text size={11} color="#8C9199">
              ORDER FOR
            </Text>
            <Text size={20} weight="medium">
              Liya
            </Text>
            <Text size={13} color="#AC8C42">
              Sunflower Group
            </Text>
          </View>
        </View>
      </Card>
      <Card>
        <View style={s.between}>
          <Text size={19} weight="medium">
            Order Summary
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
          >
            <Text size={13} style={{ textDecorationLine: "underline" }}>
              Edit Cart
            </Text>
          </Pressable>
        </View>
        {cart.map((i) => (
          <View
            key={i.product.id}
            style={{
              paddingVertical: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#EDE9E3",
            }}
          >
            <View style={s.between}>
              <Text>{i.product.name}</Text>
              <Text>{formatMoney(Number(i.product.price) * i.quantity)}</Text>
            </View>
            <Text size={13} color="#7A828F" style={{ marginTop: 7 }}>
              Qty: {i.quantity}
            </Text>
          </View>
        ))}
        <View style={[s.between, { marginTop: 20 }]}>
          <Text size={18} weight="semibold">
            Total
          </Text>
          <Text size={18} weight="semibold">
            {formatMoney(cartTotal)}
          </Text>
        </View>
      </Card>
      <Text
        size={17}
        weight="medium"
        style={{ marginTop: 28, marginBottom: 14 }}
      >
        Payment Method
      </Text>
      {[
        {
          key: "pay_at_daycare" as const,
          title: "Pay at Daycare",
          text: "Complete payment at the daycare.",
          Icon: Storefront,
        },
        {
          key: "digital" as const,
          title: "Digital Payment",
          text: "Pay through the supported gateway.",
          Icon: DeviceMobile,
        },
      ].map((p) => (
        <Pressable
          key={p.key}
          accessibilityRole="radio"
          accessibilityState={{ checked: method === p.key }}
          aria-checked={method === p.key}
          onPress={() => setMethod(p.key)}
          style={{
            borderWidth: method === p.key ? 2 : 1,
            borderColor: method === p.key ? "#092036" : "#F1EDE5",
            backgroundColor: method === p.key ? "#F6F5ED" : "white",
            borderRadius: 21,
            padding: 17,
            marginBottom: 10,
          }}
        >
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: method === p.key ? "#10263B" : "#9A9EA7",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 3,
              }}
            >
              {method === p.key && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#10263B",
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.row}>
                <p.Icon size={19} />
                <Text weight="semibold">{p.title}</Text>
              </View>
              <Text size={13} color="#7E8591" style={{ marginTop: 6 }}>
                {p.text}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
      <View style={{ height: 16 }} />
      <Field
        label="Order Note (Optional)"
        placeholder="Add a note for the daycare…"
        multiline
        value={note}
        onChangeText={setNote}
      />
      <Notice>
        This is a design preview. No order or payment will be submitted.
      </Notice>
      <Button
        title="Preview Order"
        icon={CheckCircle}
        disabled={!cart.length}
        onPress={place}
        style={{ marginTop: 20 }}
      />
    </Page>
  );
}
