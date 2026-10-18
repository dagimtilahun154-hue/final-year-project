import React, { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import {
  LockKey,
  Package,
  CalendarBlank,
  ChatCircle,
  Clock,
  Bell,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Badge,
  Field,
  Button,
  Notice,
  MenuRow,
  Section,
  s,
} from "../../components/design/System";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { getMyOrders, OrderRecord } from "../../api/parentApi";
import { formatMoney } from "../store/catalog";

export function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyOrders();
      setOrders(data);
    } catch {
      // Gracefully handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const unsubscribe = navigation.addListener?.("focus", loadOrders);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigation, loadOrders]);

  const getStatusTone = (status: string): "green" | "gold" | "neutral" | "red" => {
    switch (status) {
      case "collected":
        return "green";
      case "ready_for_pickup":
      case "confirmed":
        return "green";
      case "cancelled":
        return "red";
      case "placed":
      default:
        return "gold";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").toUpperCase();
  };

  return (
    <Page title="My Orders" back tabs activeTab="Profile">
      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#061224" />
          <Text size={13} color="#8A919B" style={{ marginTop: 12 }}>
            Loading orders…
          </Text>
        </View>
      ) : orders.length > 0 ? (
        orders.map((o) => (
          <Card key={o.id} style={{ marginBottom: 14, padding: 18 }}>
            <View style={[s.row, { alignItems: "flex-start" }]}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#F2F4F7",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Package size={22} color="#10263D" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={[s.between, { flexWrap: "wrap", gap: 4 }]}>
                  <Text size={16} weight="semibold">
                    Order #{o.id}
                  </Text>
                  <Badge
                    title={formatStatus(o.order_status)}
                    tone={getStatusTone(o.order_status)}
                  />
                </View>
                <Text size={12} color="#818A96" style={{ marginTop: 4 }}>
                  {new Date(o.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                {o.items && o.items.length > 0 ? (
                  <Text size={13} color="#4D5663" style={{ marginTop: 6 }}>
                    {o.items.map((i) => `${i.product_name} (×${i.quantity})`).join(", ")}
                  </Text>
                ) : null}
                <View style={[s.between, { marginTop: 10, borderTopWidth: 1, borderTopColor: "#EDEAE4", paddingTop: 8 }]}>
                  <Text size={12} color="#8A919B">Payment: {o.payment_status.toUpperCase()}</Text>
                  <Text size={15} weight="bold" color="#10263D">
                    {formatMoney(Number(o.total))}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card style={{ padding: 24, alignItems: "center" }}>
          <Package size={48} color="#A2A7B0" />
          <Text size={19} weight="semibold" style={{ marginTop: 14 }}>
            No orders placed yet
          </Text>
          <Text color="#7E8793" style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
            Browse uniforms, books, diapers, and supplies available in the daycare store.
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
  const [tab, setTab] = useState<"inbox" | "preferences">("inbox");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("ankelba_read_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [acknowledgedIds, setAcknowledgedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("ankelba_acknowledged_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Notification Preferences
  const [prefReports, setPrefReports] = useState(true);
  const [prefMessages, setPrefMessages] = useState(true);
  const [prefAnnouncements, setPrefAnnouncements] = useState(true);
  const [prefEmergencies, setPrefEmergencies] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnnouncements().catch(() => []);
      setAnnouncements(data);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = (id: number) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem("ankelba_read_notifications", JSON.stringify(updated));
      } catch {}
    }
  };

  const dismissNotification = (id: number) => {
    const updated = [...readIds, id];
    setReadIds(updated);
    try {
      localStorage.setItem("ankelba_read_notifications", JSON.stringify(updated));
    } catch {}
  };

  const acknowledgeAlert = (id: number) => {
    const updated = [...acknowledgedIds, id];
    setAcknowledgedIds(updated);
    markAsRead(id);
    try {
      localStorage.setItem("ankelba_acknowledged_notifications", JSON.stringify(updated));
    } catch {}
  };

  return (
    <Page title="Notifications" back tabs activeTab="Profile">
      {/* Tab Switcher */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F1F0F5",
          borderRadius: 14,
          padding: 4,
          marginBottom: 18,
        }}
      >
        <Button
          title="Inbox & Alerts"
          variant={tab === "inbox" ? "primary" : "ghost"}
          onPress={() => setTab("inbox")}
          style={{ flex: 1, minHeight: 38 }}
        />
        <Button
          title="Preferences"
          variant={tab === "preferences" ? "primary" : "ghost"}
          onPress={() => setTab("preferences")}
          style={{ flex: 1, minHeight: 38 }}
        />
      </View>

      {tab === "inbox" ? (
        <>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#061224" />
              <Text size={13} color="#8A919B" style={{ marginTop: 12 }}>
                Loading updates…
              </Text>
            </View>
          ) : announcements.length > 0 ? (
            announcements.map((item) => {
              const isRead = readIds.includes(item.id);
              const isUrgent = item.announcement_type === "urgent" || item.announcement_type === "emergency";
              const isAcknowledged = acknowledgedIds.includes(item.id);

              return (
                <Card
                  key={item.id}
                  style={{
                    marginBottom: 12,
                    padding: 16,
                    borderLeftWidth: isUrgent ? 4 : isRead ? 0 : 3,
                    borderLeftColor: isUrgent ? "#E03131" : isRead ? "transparent" : "#2F80ED",
                    backgroundColor: isRead ? "#FFFFFF" : isUrgent ? "#FFF5F5" : "#F8FBFF",
                  }}
                >
                  <View style={[s.between, { alignItems: "flex-start", marginBottom: 6 }]}>
                    <Text size={15} weight={isRead ? "medium" : "bold"}>
                      {item.title}
                    </Text>
                    <Badge
                      title={isUrgent ? "URGENT" : isRead ? "READ" : "NEW"}
                      tone={isUrgent ? "red" : isRead ? "neutral" : "green"}
                    />
                  </View>
                  <Text size={13} color="#555E6B" style={{ lineHeight: 19 }}>
                    {item.body}
                  </Text>
                  <View
                    style={[
                      s.between,
                      {
                        marginTop: 12,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: "#EDEAE4",
                      },
                    ]}
                  >
                    <Text size={11} color="#8A919B">
                      {new Date(item.created_at || Date.now()).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {isUrgent && !isAcknowledged ? (
                        <Button
                          title="Acknowledge Receipt"
                          size="small"
                          onPress={() => acknowledgeAlert(item.id)}
                        />
                      ) : (
                        <Button
                          title={isRead ? "Dismiss" : "Mark as read"}
                          variant="ghost"
                          size="small"
                          onPress={() => (isRead ? dismissNotification(item.id) : markAsRead(item.id))}
                        />
                      )}
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <Card style={{ padding: 28, alignItems: "center" }}>
              <Bell size={42} color="#A2A7B0" />
              <Text size={17} weight="semibold" style={{ marginTop: 14 }}>
                Your inbox is clean
              </Text>
              <Text size={13} color="#7E8793" style={{ textAlign: "center", marginTop: 6 }}>
                You will receive urgent daycare announcements, daily logs, and messages right here.
              </Text>
            </Card>
          )}

          {/* Quick shortcuts to Reports & Messages */}
          <Section title="Channels" />
          <Card style={{ paddingVertical: 0 }}>
            <MenuRow
              title="Daily Activity Reports"
              icon={CalendarBlank}
              onPress={() => navigation.navigate("MainTabs", { screen: "Reports" })}
            />
            <MenuRow
              title="Messages & Caregiver Chat"
              icon={ChatCircle}
              onPress={() => navigation.navigate("MainTabs", { screen: "Messages" })}
              last
            />
          </Card>
        </>
      ) : (
        <Card style={{ padding: 18 }}>
          <Text size={16} weight="semibold" style={{ marginBottom: 16 }}>
            Notification Preferences
          </Text>
          <View style={[s.between, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDEAE4" }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text size={14} weight="medium">Daily Activity Reports</Text>
              <Text size={12} color="#7E8793">Alert when meals, naps, and activities are logged</Text>
            </View>
            <Button
              title={prefReports ? "ON" : "OFF"}
              variant={prefReports ? "primary" : "secondary"}
              size="small"
              onPress={() => setPrefReports(!prefReports)}
            />
          </View>
          <View style={[s.between, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDEAE4" }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text size={14} weight="medium">Direct Messages</Text>
              <Text size={12} color="#7E8793">Notifications for caregiver notes and inquiries</Text>
            </View>
            <Button
              title={prefMessages ? "ON" : "OFF"}
              variant={prefMessages ? "primary" : "secondary"}
              size="small"
              onPress={() => setPrefMessages(!prefMessages)}
            />
          </View>
          <View style={[s.between, { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EDEAE4" }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text size={14} weight="medium">Daycare Announcements</Text>
              <Text size={12} color="#7E8793">Events, holiday schedules, and general updates</Text>
            </View>
            <Button
              title={prefAnnouncements ? "ON" : "OFF"}
              variant={prefAnnouncements ? "primary" : "secondary"}
              size="small"
              onPress={() => setPrefAnnouncements(!prefAnnouncements)}
            />
          </View>
          <View style={[s.between, { paddingVertical: 12 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text size={14} weight="medium">Urgent Safety Alerts</Text>
              <Text size={12} color="#7E8793">Emergency notices (cannot be disabled)</Text>
            </View>
            <Badge title="REQUIRED" tone="red" />
          </View>
        </Card>
      )}
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
      setMessage("Password updated successfully.");
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
