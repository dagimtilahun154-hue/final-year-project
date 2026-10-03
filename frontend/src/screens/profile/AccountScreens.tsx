import React, { useState } from "react";
import { View } from "react-native";
import {
  LockKey,
  Package,
  CalendarBlank,
  ChatCircle,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Field,
  Button,
  Notice,
  MenuRow,
  s,
} from "../../components/design/System";
import { useDesign } from "../../context/DesignContext";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { formatMoney } from "../store/catalog";
export function OrdersScreen({ navigation }: any) {
  const { order } = useDesign();
  return (
    <Page title="My Orders" back tabs activeTab="Profile">
      {order ? (
        <Card onPress={() => navigation.navigate("OrderConfirmation")}>
          <View style={s.row}>
            <Package size={28} />
            <View>
              <Text weight="semibold">#{order.reference}</Text>
              <Text size={12} color="#818A96">
                Preview · {formatMoney(order.total)}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Text size={21} weight="semibold">
            No orders yet
          </Text>
          <Text color="#7E8793" style={{ marginVertical: 16 }}>
            Find everyday essentials in the daycare store.
          </Text>
          <Button
            title="Visit Store"
            onPress={() => navigation.navigate("DaycareStore")}
          />
        </Card>
      )}
    </Page>
  );
}
export function NotificationsScreen({ navigation }: any) {
  return (
    <Page title="Notifications" back>
      <Card style={{ paddingVertical: 0 }}>
        <MenuRow
          title="Liya’s daily report is ready"
          icon={CalendarBlank}
          onPress={() =>
            navigation.navigate("FullDailyReport", { reportId: 1 })
          }
        />
        <MenuRow
          title="A message from Sara"
          icon={ChatCircle}
          onPress={() => navigation.navigate("CaregiverChat", { threadId: 1 })}
          last
        />
      </Card>
    </Page>
  );
}
export function SecurityScreen() {
  const { token } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!token) {
      setMessage("Sign in to change your password.");
      return;
    }
    if (password !== confirm || password.length < 8) {
      setMessage(
        "Use at least 8 characters and make sure both passwords match.",
      );
      return;
    }
    setBusy(true);
    try {
      await apiClient.patch("/auth/change-password", {
        current_password: current,
        new_password: password,
      });
      setMessage("Password updated.");
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch {
      setMessage(
        "Unable to update your password. Check your current password and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Security & Password" back>
      <Card>
        <Field
          label="Current Password"
          icon={LockKey}
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
        />
        <Field
          label="New Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Field
          label="Confirm New Password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
      </Card>
      {message ? <Notice>{message}</Notice> : null}
      <Button
        title="Update Password"
        loading={busy}
        onPress={save}
        style={{ marginTop: 24 }}
      />
    </Page>
  );
}
