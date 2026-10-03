import React from "react";
import { View, Switch, Pressable } from "react-native";
import {
  PencilSimple,
  UsersThree,
  Package,
  Smiley,
  ChatCircle,
  SpeakerHigh,
  User,
  LockKey,
  Globe,
  Question,
  SignOut,
  CaretRight,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Button,
  MenuRow,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useAuth } from "../../context/AuthContext";
import { useDesign } from "../../context/DesignContext";
export function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { preferences, togglePreference } = useDesign();
  return (
    <Page>
      <Card>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <Avatar source={artwork.mother} size={64} />
          <View style={{ flex: 1 }}>
            <Text size={22} weight="semibold">
              {user?.name || "Hana Tesfaye"}
            </Text>
            <Text
              size={11}
              color="#7E8793"
              style={{ letterSpacing: 0.7, marginTop: 3 }}
            >
              LIYA’S MOTHER
            </Text>
            <Text size={13} color="#767F8C" style={{ marginTop: 14 }}>
              {user?.phone || "+251 91 123 4567"}
            </Text>
            <Text size={12} color="#767F8C" style={{ marginTop: 5 }}>
              {user?.email || "hana.tesfaye@example.com"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => navigation.navigate("ParentProfile")}
            hitSlop={10}
          >
            <PencilSimple size={22} />
          </Pressable>
        </View>
      </Card>
      <Text size={19} weight="semibold" style={{ marginVertical: 22 }}>
        My Children
      </Text>
      <Card>
        <View style={s.row}>
          <Avatar source={artwork.child} />
          <View style={{ flex: 1 }}>
            <Text size={18} weight="medium">
              Liya
            </Text>
            <Text size={12} color="#7E8490">
              4 years · Sunflower Group
            </Text>
          </View>
          <Button
            title="View Profile"
            variant="secondary"
            onPress={() => navigation.navigate("ChildProfile", { childId: 1 })}
            style={{
              minHeight: 42,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}
          />
        </View>
      </Card>
      <View style={[s.row, { marginTop: 22, gap: 14 }]}>
        {[
          {
            title: "Guardians",
            sub: "View pickup contacts",
            Icon: UsersThree,
            go: "AuthorizedGuardians",
            bg: "#FFF0CA",
            ink: "#967317",
          },
          {
            title: "My Orders",
            sub: "View store status",
            Icon: Package,
            go: "Orders",
            bg: "#E8EFFC",
            ink: "#213D62",
          },
        ].map((item) => (
          <Card
            key={item.title}
            style={{ flex: 1, padding: 16 }}
            onPress={() => navigation.navigate(item.go)}
          >
            <View
              style={{
                width: 41,
                height: 41,
                borderRadius: 21,
                backgroundColor: item.bg,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <item.Icon size={23} color={item.ink} weight="fill" />
            </View>
            <Text weight="semibold">{item.title}</Text>
            <Text size={11} color="#8A8E97" style={{ marginTop: 5 }}>
              {item.sub}
            </Text>
          </Card>
        ))}
      </View>
      <Text
        size={13}
        color="#747B87"
        style={{ letterSpacing: 0.8, marginTop: 28, marginBottom: 12 }}
      >
        NOTIFICATIONS
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        {[
          { key: "activity", name: "Child Activity", Icon: Smiley },
          { key: "messages", name: "Messages", Icon: ChatCircle },
          { key: "announcements", name: "Announcements", Icon: SpeakerHigh },
        ].map((item, i) => (
          <MenuRow
            key={item.key}
            title={item.name}
            icon={item.Icon}
            last={i === 2}
          >
            <Switch
              accessibilityLabel={item.name + " notifications"}
              value={preferences[item.key]}
              onValueChange={() => togglePreference(item.key)}
              trackColor={{ false: "#E3E2E5", true: "#061224" }}
              thumbColor="white"
            />
          </MenuRow>
        ))}
      </Card>
      <Text
        size={13}
        color="#747B87"
        style={{ letterSpacing: 0.8, marginTop: 28, marginBottom: 12 }}
      >
        ACCOUNT
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        <MenuRow
          title="Personal Information"
          icon={User}
          onPress={() => navigation.navigate("ParentProfile")}
        />
        <MenuRow
          title="Security & Password"
          icon={LockKey}
          onPress={() => navigation.navigate("Security")}
          last
        />
      </Card>
      <Text
        size={13}
        color="#747B87"
        style={{ letterSpacing: 0.8, marginTop: 28, marginBottom: 12 }}
      >
        EXPLORE
      </Text>
      <Card style={{ paddingVertical: 0 }}>
        <MenuRow
          title="Daycare Store"
          icon={Package}
          onPress={() => navigation.navigate("DaycareStore")}
        />
        <MenuRow
          title="Help & Support"
          icon={Question}
          onPress={() => navigation.navigate("CaregiverChat", { threadId: 2 })}
          last
        />
      </Card>
      <Button
        title="Log Out"
        icon={SignOut}
        variant="danger"
        onPress={async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }}
        style={{ alignSelf: "center", minHeight: 46, marginTop: 32 }}
      />
    </Page>
  );
}
