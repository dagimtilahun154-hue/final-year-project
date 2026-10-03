import React, { useState } from "react";
import { View } from "react-native";
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
import { events } from "./CalendarScreen";
import { useDesign } from "../../context/DesignContext";
export function EventDetailScreen({ navigation, route }: any) {
  const event = events.find((e) => e.id === (route.params?.eventId ?? 1));
  const { reminders, toggleReminder } = useDesign();
  if (!event)
    return (
      <Page title="Event Details" back>
        <Card>
          <Text>This event is unavailable.</Text>
        </Card>
      </Page>
    );
  const reminded = reminders.includes(event.id);
  const closed = event.category === "Holiday";
  const preparation = closed
    ? [
        "Plan alternative care for this date.",
        "Contact the office if you have questions.",
      ]
    : event.category === "Activity"
      ? [
          "Follow your caregiver’s preparation notes.",
          "Comfortable play clothes are recommended.",
        ]
      : [
          "Please arrive 10 minutes early.",
          "Bring any questions for your caregiver.",
          "Contact the daycare if you cannot attend.",
        ];
  return (
    <Page title="Event Details" back tabs activeTab="Calendar">
      <Card>
        <View style={s.between}>
          <Text size={21} weight="semibold" style={{ flex: 1 }}>
            {event.title}
          </Text>
          <Badge title={event.category} tone="neutral" />
        </View>
        <View style={[s.row, { marginTop: 26 }]}>
          <CalendarBlank size={23} color="#B38C28" />
          <View style={{ flex: 1 }}>
            <Text>
              {new Date(event.year, event.month, event.day).toLocaleDateString(
                "en-US",
                { weekday: "long", month: "long", day: "numeric" },
              )}
            </Text>
            <Text size={13} color="#777E88">
              {event.time}
            </Text>
          </View>
        </View>
        <View style={[s.row, { marginTop: 18 }]}>
          <MapPin size={23} color="#B38C28" />
          <View style={{ flex: 1 }}>
            <Text>{event.place}</Text>
            <Text size={13} color="#777E88">
              Ankelba Early Learning
            </Text>
          </View>
        </View>
      </Card>
      <Section title="About this event" />
      <Card>
        <Text color="#707883">{event.description}</Text>
      </Card>
      <Section title={closed ? "Daycare schedule" : "Who should attend"} />
      <Card>
        <View style={s.row}>
          <UsersThree size={26} color="#A8774B" />
          <Text style={{ flex: 1 }}>
            {closed
              ? "No daycare sessions on this date."
              : event.category === "Activity"
                ? "Children and families, as arranged by the daycare."
                : "Parents or authorized guardians"}
          </Text>
        </View>
      </Card>
      <Section title="Good to know" />
      <Card>
        {preparation.map((t) => (
          <View
            key={t}
            style={[s.row, { alignItems: "flex-start", marginBottom: 10 }]}
          >
            <CheckCircle size={19} color="#CBA634" />
            <Text size={14} color="#747B85" style={{ flex: 1 }}>
              {t}
            </Text>
          </View>
        ))}
      </Card>
      <Card tint="#F5F4EA" style={{ marginTop: 24 }}>
        <View style={s.row}>
          <Avatar source={artwork.child} size={38} />
          <Text size={13}>For Liya · Sunflower Group</Text>
        </View>
      </Card>
      {reminded && (
        <Notice tone="success">
          Saved to your reminders for this session.
        </Notice>
      )}
      <Button
        title={reminded ? "Reminder Added" : "Add Reminder"}
        icon={Bell}
        onPress={() => toggleReminder(event.id)}
        style={{ marginTop: 26 }}
      />
      <Button
        title="Message Daycare"
        icon={ChatCircle}
        variant="outline"
        onPress={() => navigation.navigate("CaregiverChat", { threadId: 2 })}
        style={{ marginTop: 10 }}
      />
    </Page>
  );
}
