import React from "react";
import { View } from "react-native";
import {
  CalendarBlank,
  ChatCircle,
  Heart,
  UsersThree,
  ForkKnife,
  ShieldCheck,
  Phone,
  Info,
} from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Section,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
export function ChildProfileScreen({ navigation }: any) {
  return (
    <Page title="Child Profile" back tabs activeTab="Profile">
      <Card style={{ alignItems: "center", paddingVertical: 28 }}>
        <Avatar source={artwork.profileChild} size={90} />
        <View style={{ marginTop: -5, marginBottom: 14 }}>
          <Badge title="● At Daycare" />
        </View>
        <Text size={23} weight="semibold">
          Liya Hana
        </Text>
        <Text size={13} color="#858A93" style={{ marginTop: 5 }}>
          4 years · Sunflower Group
        </Text>
        <View style={[s.row, { marginTop: 23, width: "100%" }]}>
          <Button
            title="Report"
            icon={CalendarBlank}
            onPress={() =>
              navigation.navigate("FullDailyReport", { reportId: 1 })
            }
            style={{ flex: 1, minHeight: 45, paddingHorizontal: 10 }}
          />
          <Button
            title="Message"
            icon={ChatCircle}
            variant="secondary"
            onPress={() =>
              navigation.navigate("CaregiverChat", { threadId: 1 })
            }
            style={{
              flex: 1,
              minHeight: 45,
              paddingHorizontal: 10,
              backgroundColor: "#FFF4D5",
            }}
          />
        </View>
      </Card>
      <Section title="Basic Information" />
      <Card>
        <Text size={11} color="#89909B">
          DATE OF BIRTH
        </Text>
        <Text style={{ marginTop: 4 }}>May 12, 2022</Text>
        <Text size={11} color="#89909B" style={{ marginTop: 20 }}>
          PRIMARY LANGUAGE
        </Text>
        <Text style={{ marginTop: 4 }}>Amharic, English</Text>
        <View style={[s.between, { marginTop: 24 }]}>
          <Text size={11} color="#89909B">
            ATTENDANCE HISTORY
          </Text>
          <Text size={12}>92%</Text>
        </View>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: "#EFEDF1",
            marginTop: 9,
          }}
        >
          <View
            style={{
              height: 5,
              width: "92%",
              borderRadius: 3,
              backgroundColor: "#FFC533",
            }}
          />
        </View>
      </Card>
      <Section title="Care & Safety" />
      <Card>
        <View style={s.row}>
          <Avatar source={artwork.caregiver} size={44} />
          <View>
            <Text size={11} color="#8A909B">
              LEAD CAREGIVER
            </Text>
            <Text>Sara M.</Text>
          </View>
        </View>
        <View style={s.divider} />
        {[
          {
            label: "Meal Preferences",
            text: "Soft fruits, small pieces, bananas, and injera.",
            Icon: ForkKnife,
          },
          {
            label: "Care Instructions",
            text: "Encourage water during the day, especially after outdoor play.",
            Icon: ShieldCheck,
          },
          { label: "Allergies", text: "No known allergies.", Icon: Heart },
        ].map((item) => (
          <View
            key={item.label}
            style={[s.row, { alignItems: "flex-start", marginBottom: 20 }]}
          >
            <item.Icon size={21} color="#B99A3E" />
            <View style={{ flex: 1 }}>
              <Text weight="semibold" size={14}>
                {item.label}
              </Text>
              <Text color="#7C838F" size={13} style={{ marginTop: 4 }}>
                {item.text}
              </Text>
            </View>
          </View>
        ))}
      </Card>
      <Section title="Family & Contacts" />
      <Card>
        <View style={s.row}>
          <Avatar source={artwork.mother} size={42} />
          <View style={{ flex: 1 }}>
            <Text>Hana Tesfaye</Text>
            <Text size={11} color="#858B96">
              Mother · Primary guardian
            </Text>
          </View>
          <Phone size={20} color="#B1974B" />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Avatar source={artwork.father} size={42} />
          <View>
            <Text>Abel Mekonnen</Text>
            <Text size={11} color="#858B96">
              Father · Authorized pickup
            </Text>
          </View>
        </View>
        <Button
          title="View Authorized Pickups"
          icon={UsersThree}
          variant="outline"
          onPress={() => navigation.navigate("AuthorizedGuardians")}
          style={{ marginTop: 24 }}
        />
      </Card>
    </Page>
  );
}
