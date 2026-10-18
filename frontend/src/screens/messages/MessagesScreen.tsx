import React, { useState, useEffect, useCallback } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import {
  MagnifyingGlass,
  SpeakerHigh,
  ChatCircle,
  Clock,
  User,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Button,
  Field,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import {
  getDirectMessages,
  getAnnouncements,
  getCommunicationContacts,
  DirectMessage,
  DaycareAnnouncement,
  CommunicationContact,
} from "../../api/parentApi";

interface ChatThreadSummary {
  id: number;
  recipientId: number;
  name: string;
  role: string;
  message: string;
  time: string;
  unread: number;
  photo?: any;
}

export function MessagesScreen({ navigation }: any) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"Messages" | "Announcements">("Messages");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [announcements, setAnnouncements] = useState<DaycareAnnouncement[]>([]);
  const [contacts, setContacts] = useState<CommunicationContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const [msgData, annData, contactsData] = await Promise.all([
        getDirectMessages(),
        getAnnouncements(),
        getCommunicationContacts(),
      ]);
      setMessages(msgData);
      setAnnouncements(annData);
      setContacts(contactsData);
    } catch {
      setLoadError("Could not load your daycare contacts and messages. Please retry.");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener?.("focus", loadData);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigation, loadData]);

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Build threads from contacts and database messages (F07 fix: dynamically target real daycare staff)
  const threads: ChatThreadSummary[] = [];

  if (contacts.length > 0) {
    contacts.forEach((contact, idx) => {
      const contactMsgs = messages
        .filter((m) => m.sender_id === contact.id || m.recipient_id === contact.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const latest = contactMsgs[0];
      const isCaregiver = contact.role === "caregiver";

      threads.push({
        id: idx + 1,
        recipientId: contact.id,
        name: contact.name,
        role:
          contact.title ||
          (isCaregiver ? "Assigned Child Caregiver" : "Daycare Administration & Front Desk"),
        message: latest
          ? latest.body
          : isCaregiver
          ? "Direct messages with your child's primary caregiver"
          : "Questions about enrollment, schedules, or payments",
        time: latest ? formatTime(latest.created_at) : "Available",
        unread: contactMsgs.filter((m) => !m.read_at && m.sender_id === contact.id).length,
        photo: isCaregiver ? artwork.caregiver : undefined,
      });
    });
  }

  const query = search.trim().toLowerCase();

  const visibleThreads = threads.filter((t) =>
    (t.name + " " + t.message + " " + t.role).toLowerCase().includes(query)
  );

  const visibleAnnouncements = announcements.filter((a) =>
    (a.title + " " + a.body + " " + (a.author_name || "")).toLowerCase().includes(query)
  );

  const empty = (
    <Card>
      <Text size={18} weight="semibold">
        {loadError ? "Unable to load messages" : query ? "No matches" : "No updates yet"}
      </Text>
      <Text color="#747B84" style={{ marginTop: 8, marginBottom: 18 }}>
        {loadError || (tab === "Messages"
          ? (query ? "No messages matching your search." : "No staff contacts are available. Contact your daycare administrator.")
          : "No announcements available.")}
      </Text>
      <Button
        title={query ? "Clear Search" : "Retry"}
        variant="secondary"
        onPress={() => query ? setSearch("") : loadData()}
      />
    </Card>
  );

  return (
    <Page title="Messages & Notices" subtitle="Stay connected with your child's educators and daycare office.">
      <Field
        icon={MagnifyingGlass}
        placeholder={
          tab === "Messages" ? "Search conversations…" : "Search announcements…"
        }
        value={search}
        onChangeText={setSearch}
      />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
        {(["Messages", "Announcements"] as const).map((t) => (
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
            <Text size={14} color={tab === t ? "white" : "#6C7380"} weight={tab === t ? "semibold" : "regular"}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#061224" />
          <Text size={13} color="#8A919B" style={{ marginTop: 12 }}>
            Loading updates from daycare…
          </Text>
        </View>
      ) : tab === "Messages" ? (
        visibleThreads.length ? (
          visibleThreads.map((t) => (
            <Card
              key={t.id}
              onPress={() =>
                navigation.navigate("CaregiverChat", {
                  threadId: t.id,
                  recipientId: t.recipientId,
                  recipientName: t.name,
                  recipientRole: contacts.find(contact => contact.id === t.recipientId)?.role,
                })
              }
              style={{ marginBottom: 14, padding: 18 }}
            >
              <View style={[s.row, { alignItems: "flex-start" }]}>
                <Avatar source={t.photo} initials={t.name.slice(0, 2).toUpperCase()} size={52} />
                <View style={{ flex: 1 }}>
                  <View style={[s.between, { flexWrap: "wrap", gap: 4 }]}>
                    <Text size={17} weight="semibold">
                      {t.name}
                    </Text>
                    <Text size={11} color="#9397A0">
                      {t.time}
                    </Text>
                  </View>
                  <Text size={11} color="#878B95" style={{ marginBottom: 4 }}>
                    {t.role}
                  </Text>
                  <Text
                    size={13}
                    color="#4D5663"
                    numberOfLines={2}
                    style={{ marginTop: 4 }}
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
                      marginLeft: 8,
                      alignSelf: "center",
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
      ) : visibleAnnouncements.length > 0 ? (
        visibleAnnouncements.map((a) => (
          <Card
            key={a.id}
            tint={a.announcement_type === "meal_plan" ? "#F5F8F4" : "#FFFAE5"}
            style={{ marginBottom: 14, padding: 18 }}
          >
            <View style={[s.row, { marginBottom: 8 }]}>
              <SpeakerHigh
                size={22}
                color={a.announcement_type === "meal_plan" ? "#3B7A57" : "#B68C20"}
              />
              <Text size={17} weight="semibold" style={{ flex: 1 }}>
                {a.title}
              </Text>
            </View>
            <Text color="#4D5663" size={14} style={{ marginBottom: 12, lineHeight: 20 }}>
              {a.body}
            </Text>
            <View style={[s.between, { borderTopWidth: 1, borderTopColor: "#ECEAE3", paddingTop: 10 }]}>
              <Text size={11} color="#828995">
                Posted by {a.author_name || "Administration"}
              </Text>
              <Text size={11} color="#828995">
                {new Date(a.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text size={17} weight="semibold">
            No Announcements Found
          </Text>
          <Text color="#747B84" style={{ marginTop: 8 }}>
            There are currently no active announcements from the daycare center.
          </Text>
        </Card>
      )}
    </Page>
  );
}
