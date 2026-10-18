import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { User, Phone, EnvelopeSimple, UserPlus } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Field,
  Button,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useChild } from "../../context/ChildContext";
import { apiClient } from "../../api/client";
import { contactError } from "../../utils/contact";

export function AddGuardianScreen({ navigation }: any) {
  const { selectedChild } = useChild();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("Mother");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const problem = contactError(name, phone, email);
    if (problem) {
      setError(problem);
      return;
    }
    if (!selectedChild?.id) {
      setError("Please select a child first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      // Post guardian request to real backend endpoint
      await apiClient.post(`/children/${selectedChild.id}/guardians`, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        relationship: relation,
        pickup_authorized: false,
      });
      navigation.goBack();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to submit guardian registration request.");
    } finally {
      setSaving(false);
    }
  };

  const childName = selectedChild?.full_name ? selectedChild.full_name.split(" ")[0] : "Child";
  const groupName = selectedChild?.group_name || "Daycare Group";

  return (
    <Page
      title="Add Guardian"
      subtitle={`Add a trusted adult for ${childName}.`}
      back
      tabs
      activeTab="Profile"
    >
      <Card tint="#FFFAEE" style={{ marginBottom: 22 }}>
        <View style={s.row}>
          <Avatar source={artwork.guardianChild} initials={childName.slice(0, 2).toUpperCase()} />
          <View>
            <Text size={20} weight="semibold">
              {selectedChild?.full_name || childName}
            </Text>
            <Text size={12} color="#878D98">
              {groupName}
            </Text>
          </View>
        </View>
      </Card>
      <Card>
        <Field
          label="Full Name"
          icon={User}
          placeholder="Guardian’s full name"
          value={name}
          onChangeText={setName}
        />
        <Text size={14} weight="semibold" style={{ marginBottom: 10 }}>
          Relationship
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 22,
          }}
        >
          {["Mother", "Father", "Aunt", "Uncle", "Other"].map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: r === relation }}
              aria-pressed={r === relation}
              onPress={() => setRelation(r)}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderRadius: 20,
                backgroundColor: r === relation ? "#061224" : "#EFEEF1",
              }}
            >
              <Text size={12} color={r === relation ? "white" : "#6C7480"}>
                {r}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Phone Number"
          icon={Phone}
          placeholder="+251…"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Field
          label="Email Address"
          icon={EnvelopeSimple}
          placeholder="Email address (optional)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Card>
      <Notice>
        Draft only. Daycare staff approve pickup access and arrange adult
        verification.
      </Notice>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        title="Submit Guardian Request"
        icon={UserPlus}
        loading={saving}
        onPress={save}
        style={{ marginTop: 20 }}
      />
    </Page>
  );
}
