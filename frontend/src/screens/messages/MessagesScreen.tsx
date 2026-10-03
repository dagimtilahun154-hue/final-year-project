import React, { useState } from "react";
import { View, Pressable } from "react-native";
import {
  MagnifyingGlass,
  SpeakerHigh,
  ChatCircle,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Button,
  Field,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
const threads = [
  {
    id: 1,
    name: "Sara",
    role: "Liya’s caregiver",
    message: "Liya had a great morning today.",
    time: "11:21 AM",
    unread: 2,
    photo: artwork.caregiver,
  },
  {
    id: 2,
    name: "Daycare Office",
    role: "Ankelba Early Learning",
    message: "A reminder about Friday’s parent meeting.",
    time: "Yesterday",
    unread: 0,
    photo: undefined,
  },
];
export function MessagesScreen({ navigation }: any) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Messages");
  const query = search.trim().toLowerCase();
  const visibleThreads = threads.filter((t) =>
    (t.name + " " + t.message).toLowerCase().includes(query),
  );
  const showAnnouncement =
    "parent meeting join us friday at 3:00 pm daycare main room".includes(
      query,
    );
  const empty = (
    <Card>
      <Text size={18} weight="semibold">
        No matches
      </Text>
      <Text color="#747B84" style={{ marginTop: 8, marginBottom: 18 }}>
        Try a name or a different keyword.
      </Text>
      <Button
        title="Clear Search"
        variant="secondary"
        onPress={() => setSearch("")}
      />
    </Card>
  );
  return (
    <Page title="Messages" subtitle="A little closer to their day.">
      <Field
        icon={MagnifyingGlass}
        placeholder={
          tab === "Messages" ? "Search messages…" : "Search announcements…"
        }
        value={search}
        onChangeText={setSearch}
      />
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
        {["Messages", "Announcements"].map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            aria-pressed={tab === t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              alignItems: "center",
              padding: 12,
              borderRadius: 22,
              backgroundColor: tab === t ? "#061224" : "#EEEDF0",
            }}
          >
            <Text size={14} color={tab === t ? "white" : "#6C7380"}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "Messages" ? (
        visibleThreads.length ? (
          visibleThreads.map((t) => (
            <Card
              key={t.id}
              onPress={() =>
                navigation.navigate("CaregiverChat", { threadId: t.id })
              }
              style={{ marginBottom: 14, padding: 18 }}
            >
              <View style={[s.row, { alignItems: "flex-start" }]}>
                <Avatar source={t.photo} initials="AN" size={52} />
                <View style={{ flex: 1 }}>
                  <View style={[s.between, { flexWrap: "wrap", gap: 4 }]}>
                    <Text size={18} weight="semibold">
                      {t.name}
                    </Text>
                    <Text size={10} color="#9397A0">
                      {t.time}
                    </Text>
                  </View>
                  <Text size={11} color="#878B95">
                    {t.role}
                  </Text>
                  <Text
                    size={13}
                    color="#6F7783"
                    numberOfLines={2}
                    style={{ marginTop: 7 }}
                  >
                    {t.message}
                  </Text>
                </View>
                {t.unread > 0 && (
                  <View
                    style={{
                      backgroundColor: "#FFCA32",
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 39,
                    }}
                  >
                    <Text size={11} weight="bold">
                      {t.unread}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          ))
        ) : (
          empty
        )
      ) : showAnnouncement ? (
        <Card tint="#FFFAE5">
          <View style={s.row}>
            <SpeakerHigh size={23} color="#B68C20" />
            <Text size={18} weight="semibold">
              Parent Meeting
            </Text>
          </View>
          <Text color="#747B84" style={{ marginVertical: 14 }}>
            Join us this Friday at 3:00 PM in the daycare main room.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("EventDetail", { eventId: 1 })}
          >
            <Text weight="semibold">View Details →</Text>
          </Pressable>
        </Card>
      ) : (
        empty
      )}
    </Page>
  );
}
