import React, { useState } from "react";
import { View, Pressable } from "react-native";
import {
  CaretLeft,
  CaretRight,
  Clock,
  CalendarBlank,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Button,
  Badge,
  s,
  IconButton,
  Section,
} from "../../components/design/System";
export const events = [
  {
    id: 1,
    title: "Parent Meeting",
    day: 28,
    month: 7,
    year: 2026,
    time: "3:00 PM – 4:00 PM",
    place: "Daycare Main Room",
    category: "Meeting",
    color: "#E2F5F1",
    ink: "#298C81",
    description:
      "A short meeting to discuss your child’s progress, upcoming activities, and daycare updates.",
  },
  {
    id: 2,
    title: "Family Activity Day",
    day: 5,
    month: 8,
    year: 2026,
    time: "10:00 AM",
    place: "Outdoor Play Area",
    category: "Activity",
    color: "#EAF6E6",
    ink: "#5A9751",
    description:
      "Join us for a morning of games, creativity, and time together.",
  },
  {
    id: 3,
    title: "Public Holiday",
    day: 7,
    month: 8,
    year: 2026,
    time: "All day",
    place: "Daycare closed",
    category: "Holiday",
    color: "#FDEBEC",
    ink: "#C66470",
    description:
      "The daycare will be closed. We look forward to seeing everyone when we reopen.",
  },
  {
    id: 4,
    title: "Art & Creativity Day",
    day: 9,
    month: 8,
    year: 2026,
    time: "11:00 AM",
    place: "Activity Room",
    category: "Activity",
    color: "#FCECF2",
    ink: "#C57495",
    description: "A colorful day of painting, crafts, and imagination.",
  },
];
export function CalendarScreen({ navigation }: any) {
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState<number | null>(null);
  const [filter, setFilter] = useState("All");
  const first = new Date(year, month, 1).getDay(),
    count = new Date(year, month + 1, 0).getDate();
  const change = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setMonth(date.getMonth());
    setYear(date.getFullYear());
    setDay(null);
  };
  const upcoming = events.filter(
    (e) =>
      (filter === "All" || e.category === filter) &&
      (day
        ? e.day === day && e.month === month && e.year === year
        : new Date(e.year, e.month, e.day) >= new Date(year, month, 1)),
  );
  return (
    <Page title="Calendar" subtitle="Little moments to look forward to.">
      <View style={[s.row, { marginBottom: 20, flexWrap: "wrap" }]}>
        {["All", "Meeting", "Activity", "Holiday"].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            aria-pressed={filter === f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: filter === f ? "#061224" : "#F0EDF0",
            }}
          >
            <Text size={12} color={filter === f ? "white" : "#575D68"}>
              {f === "Meeting"
                ? "Meetings"
                : f === "Activity"
                  ? "Activities"
                  : f === "Holiday"
                    ? "Holidays"
                    : f}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ padding: 14 }}>
        <View style={s.between}>
          <IconButton
            icon={CaretLeft}
            label="Previous month"
            onPress={() => change(-1)}
          />
          <Text weight="semibold">
            {new Date(year, month).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <IconButton
            icon={CaretRight}
            label="Next month"
            onPress={() => change(1)}
          />
        </View>
        <View style={{ flexDirection: "row", marginVertical: 12 }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text
              key={d}
              size={11}
              color="#9699A0"
              style={{ width: "14.285%", textAlign: "center" }}
            >
              {d}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {Array.from({ length: first + count }, (_, i) => {
            const n = i - first + 1;
            return (
              <View
                key={i}
                style={{
                  width: "14.285%",
                  height: 43,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {n > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      "Select " + new Date(year, month, n).toDateString()
                    }
                    accessibilityState={{ selected: day === n }}
                    aria-pressed={day === n}
                    onPress={() => setDay(day === n ? null : n)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: day === n ? "#061224" : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text size={13} color={day === n ? "white" : "#555B66"}>
                      {n}
                    </Text>
                    {events.some(
                      (e) =>
                        e.month === month && e.year === year && e.day === n,
                    ) && (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: "#ECC455",
                          position: "absolute",
                          bottom: 2,
                        }}
                      />
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </Card>
      <Section
        title={day ? "Events on this day" : "Upcoming Events"}
        action={day ? "Show all" : undefined}
        onPress={() => setDay(null)}
      />
      {!upcoming.length && (
        <Card>
          <Text color="#757D87">
            {day
              ? "No events on this day."
              : "No upcoming events for this selection."}
          </Text>
        </Card>
      )}
      {upcoming.map((e) => (
        <Card
          key={e.id}
          style={{
            marginBottom: 15,
            borderTopWidth: 3,
            borderTopColor: e.ink,
            padding: 18,
          }}
        >
          <View style={[s.row, { alignItems: "flex-start" }]}>
            <View
              style={{
                backgroundColor: e.color,
                padding: 12,
                borderRadius: 12,
                alignItems: "center",
                minWidth: 52,
              }}
            >
              <Text size={10} color={e.ink}>
                {new Date(e.year, e.month, e.day)
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase()}
              </Text>
              <Text size={21} color={e.ink}>
                {e.day}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text size={17} weight="medium">
                {e.title}
              </Text>
              <Text size={12} color="#757C88" style={{ marginTop: 7 }}>
                {e.time} · {e.place}
              </Text>
              <Button
                title="View Details"
                onPress={() =>
                  navigation.navigate("EventDetail", { eventId: e.id })
                }
                style={{
                  alignSelf: "flex-end",
                  minHeight: 36,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  marginTop: 16,
                }}
              />
            </View>
          </View>
        </Card>
      ))}
    </Page>
  );
}
