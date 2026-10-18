import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import {
  CalendarBlank,
  MapPin,
  UsersThree,
  Bell,
  ChatCircle,
  CheckCircle,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Section,
  Button,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useDesign } from "../../context/DesignContext";
import { getDaycareEvents, CalendarEvent } from "../../api/parentApi";

export function EventDetailScreen({ navigation, route }: any) {
  const eventId = route.params?.eventId ?? 1;
  const passedEvent = route.params?.eventData;

  const [event, setEvent] = useState<CalendarEvent | null>(passedEvent || null);
  const [loading, setLoading] = useState(!passedEvent);

  useEffect(() => {
    if (!event) {
      (async () => {
        try {
          const list = await getDaycareEvents(true);
          const found = list.find((e) => e.id === eventId);
          setEvent(found || null);
        } catch {
          setEvent(null);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [eventId, event]);

  const { reminders, toggleReminder } = useDesign();

  if (loading) {
    return (
      <Page title="Event Details" back tabs activeTab="Calendar">
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color="#061224" />
          <Text size={13} color="#7E828A" style={{ marginTop: 10 }}>Loading event details…</Text>
        </Card>
      </Page>
    );
  }

  if (!event) {
    return (
      <Page title="Event Details" back tabs activeTab="Calendar">
        <Card style={{ padding: 24, alignItems: "center" }}>
          <Text size={15} weight="medium">This event is unavailable.</Text>
        </Card>
      </Page>
    );
  }

  const reminded = reminders.includes(event.id);
  const formattedDate = new Date(event.event_date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Page title="Event Details" back tabs activeTab="Calendar">
      <Card>
        <View style={s.between}>
          <Text size={21} weight="semibold" style={{ flex: 1 }}>
            {event.title}
          </Text>
          <Badge title={event.event_type.replace("_", " ")} tone="neutral" />
        </View>
        <View style={[s.row, { marginTop: 16 }]}>
          <CalendarBlank size={18} color="#858A93" />
          <Text size={14} color="#555E69" style={{ marginLeft: 8 }}>
            {formattedDate}
          </Text>
        </View>
        {event.event_time ? (
          <View style={[s.row, { marginTop: 8 }]}>
            <Text size={14} color="#555E69" style={{ marginLeft: 26 }}>
              Time: {event.event_time}
            </Text>
          </View>
        ) : null}
      </Card>

      <Section title="Description & Information" />
      <Card>
        <Text size={14} color="#2D3748" style={{ lineHeight: 22 }}>
          {event.description || "No special instructions provided for this event. Please reach out to staff with any questions."}
        </Text>
      </Card>

      <Section title="Reminders" />
      <Card>
        <View style={s.between}>
          <View style={s.row}>
            <Bell size={20} color={reminded ? "#2D6A4F" : "#8A909B"} />
            <Text size={14} weight="medium" style={{ marginLeft: 10 }}>
              {reminded ? "Reminder set for this event" : "Set event notification"}
            </Text>
          </View>
          <Button
            title={reminded ? "Turn Off" : "Remind Me"}
            variant={reminded ? "outline" : "primary"}
            onPress={() => toggleReminder(event.id)}
            style={{ minHeight: 36, paddingHorizontal: 14 }}
          />
        </View>
      </Card>

      <Button
        title="Message Daycare"
        icon={ChatCircle}
        variant="secondary"
        onPress={() => navigation.navigate("CaregiverChat", { threadId: 1 })}
        style={{ marginTop: 24, marginBottom: 20 }}
      />
    </Page>
  );
}
