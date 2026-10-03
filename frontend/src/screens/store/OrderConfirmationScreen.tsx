import React from "react";
import { View } from "react-native";
import { CheckCircle, ArrowRight } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Button,
  Notice,
  s,
} from "../../components/design/System";
import { useDesign } from "../../context/DesignContext";
import { artwork } from "../../theme/assets";
import { formatMoney } from "./catalog";
export function OrderConfirmationScreen({ navigation }: any) {
  const { order } = useDesign();
  return (
    <Page tabs activeTab="Profile">
      <View style={{ alignItems: "center", paddingVertical: 26 }}>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: "#DDEAFD",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle size={33} color="#0A2542" weight="fill" />
        </View>
        <Text
          size={28}
          weight="bold"
          style={{ textAlign: "center", marginTop: 22 }}
        >
          Your Order Preview
        </Text>
        <Text
          size={14}
          color="#7C8490"
          style={{ textAlign: "center", marginTop: 10 }}
        >
          Everything in one place.
        </Text>
      </View>
      {order ? (
        <>
          <Card tint="#F4F2F7">
            <Text size={11} color="#848B96">
              ORDER REFERENCE
            </Text>
            <Text size={22} weight="semibold" style={{ marginTop: 7 }}>
              #{order.reference}
            </Text>
            <Text size={12} color="#8B919B" style={{ marginTop: 7 }}>
              Preview · Not submitted
            </Text>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <View style={s.row}>
              <Avatar source={artwork.child} />
              <View>
                <Text size={11} color="#8B919B">
                  Order for
                </Text>
                <Text size={19} weight="semibold">
                  Liya
                </Text>
                <Text size={12} color="#8B919B">
                  Sunflower Group
                </Text>
              </View>
            </View>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <Text size={20} weight="semibold" style={{ marginBottom: 18 }}>
              Order Summary
            </Text>
            {order.items.map((i, index) => (
              <View key={index} style={[s.between, { paddingVertical: 10 }]}>
                <Text size={13} style={{ flex: 1 }}>
                  {i.name} (Qty {i.quantity})
                </Text>
                <Text size={13}>{formatMoney(i.price * i.quantity)}</Text>
              </View>
            ))}
            <View style={s.divider} />
            <View style={s.between}>
              <Text size={20} weight="semibold">
                Total
              </Text>
              <Text size={21} weight="bold">
                {formatMoney(order.total)}
              </Text>
            </View>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <View style={s.between}>
              <Text size={19} weight="semibold">
                Payment
              </Text>
              <Badge title="Not paid" tone="gold" />
            </View>
            <Text size={14} color="#7F8692" style={{ marginTop: 14 }}>
              {order.method === "pay_at_daycare"
                ? "Pay at Daycare"
                : "Digital Payment"}
            </Text>
          </Card>
        </>
      ) : (
        <Notice>No order preview yet. Visit the store to get started.</Notice>
      )}
      <Button
        title="View Orders"
        icon={ArrowRight}
        onPress={() => navigation.navigate("Orders")}
        style={{ marginTop: 26 }}
      />
      <Button
        title="Back to Home"
        variant="outline"
        onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
        style={{ marginTop: 12 }}
      />
    </Page>
  );
}
