using System;
using System.IO;
using System.Linq;
using BepInEx;
using BepInEx.Configuration;
using Newtonsoft.Json;
using UnityEngine;
using Status = CharacterAfflictions.STATUSTYPE;

[BepInPlugin("hi5ilay.peakpackplanner", "PEAK Pack Planner", "0.1.0")]
public sealed class PlannerPlugin : BaseUnityPlugin
{
    private ConfigEntry<KeyCode> markKey;
    private string snapshotPath;
    private Character previousCharacter;
    private Item marked;
    private float nextSnapshot;
    private bool reportedError;

    private void Awake()
    {
        markKey = Config.Bind("Controls", "Mark item", KeyCode.T, "Mark the highlighted item for comparison. Press with no item highlighted to clear.");
        snapshotPath = Path.Combine(Paths.BepInExRootPath, "peak-pack-planner.json");
        Logger.LogInfo("Live planner ready. Press " + markKey.Value + " over an item to compare it.");
    }

    private void LateUpdate()
    {
        var character = Character.localCharacter;
        if (character != previousCharacter)
        {
            previousCharacter = character;
            marked = null;
        }

        if (Application.isFocused && Input.GetKeyDown(markKey.Value))
        {
            marked = Interaction.instance ? Interaction.instance.currentHovered as Item : null;
            nextSnapshot = 0;
            Logger.LogInfo(marked ? "Marked " + marked.GetName() : "Cleared marked item");
        }

        if (Time.unscaledTime < nextSnapshot) return;
        nextSnapshot = Time.unscaledTime + 0.5f;
        try
        {
            Publish(character);
            reportedError = false;
        }
        catch (Exception error)
        {
            if (!reportedError) Logger.LogWarning("Could not export inventory: " + error);
            reportedError = true;
        }
    }

    private static object ReadItem(Item item, ItemInstanceData data, string slot)
    {
        if (!item) return null;
        var cooked = data != null && data.TryGetDataEntry<IntItemData>(DataEntryKey.CookedAmount, out var level)
            ? level.Value : 0;
        int? uses = data != null && data.TryGetDataEntry<OptionableIntItemData>(DataEntryKey.ItemUses, out var count)
            && count.HasData && count.Value >= 0 ? count.Value : (int?)null;
        return new {
            uid = data == null || data.guid == Guid.Empty ? slot : data.guid.ToString(),
            name = item.GetName(), gameId = item.itemID, cookLevel = cooked, usesLeft = uses, slot
        };
    }

    private void Publish(Character character)
    {
        var player = character ? character.player : null;
        var snapshot = player && !character.inAirport ? ReadRun(character, player) : null;
        var payload = JsonConvert.SerializeObject(new {
            version = 1, time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), run = snapshot
        });
        var pending = snapshotPath + ".tmp";
        File.WriteAllText(pending, payload);
        if (File.Exists(snapshotPath)) File.Replace(pending, snapshotPath, null);
        else File.Move(pending, snapshotPath);
    }

    private object ReadRun(Character character, Player player)
    {
        var bag = player.backpackSlot;
        var bagType = bag.backpackType.ToString().ToLowerInvariant();
        var pocketCount = bagType == "backpack" ? 4 : bagType == "fannypack" ? 2 : 0;
        var pockets = bag.data != null && bag.data.TryGetDataEntry<BackpackData>(DataEntryKey.BackpackData, out var contents)
            ? contents.itemSlots.Take(pocketCount).Select((slot, i) => slot == null ? null : ReadItem(slot.prefab, slot.data, "Pocket " + (i + 1))).ToArray()
            : new object[pocketCount];
        var afflictions = character.refs.afflictions;
        float StatusAmount(Status status) => afflictions.GetCurrentStatus(status) * 100;
        return new {
            bagType, bagId = bag.data?.guid.ToString(),
            hands = player.itemSlots.Select((slot, i) => ReadItem(slot.prefab, slot.data, "Hand " + (i + 1))).ToArray(),
            pockets = bag.IsEmpty() ? Array.Empty<object>() : pockets,
            marked = marked ? ReadItem(marked, marked.data, "Marked item") : null,
            ascent = Ascents.currentAscent,
            stamina = character.data.currentStamina * 100,
            extraStamina = character.data.extraStamina * 100,
            status = new {
                hunger = StatusAmount(Status.Hunger), injury = StatusAmount(Status.Injury),
                poison = StatusAmount(Status.Poison), cold = StatusAmount(Status.Cold),
                heat = StatusAmount(Status.Hot), drowsy = StatusAmount(Status.Drowsy),
                spores = StatusAmount(Status.Spores), curse = StatusAmount(Status.Curse),
                thorns = StatusAmount(Status.Thorns), petrify = character.data.petrifyAmount
            }
        };
    }
}
