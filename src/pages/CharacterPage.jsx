import {
  WEEKLY_RAID_LIMIT,
  getCharacterRaidSelection,
  getDefaultRaidSelection,
  getEligibleRulesForCharacter,
  limitRaidSelection,
  normalizeCharacter,
} from "../partyLogic.js";
import styles from "../App.module.css";

export default function CharacterPage({ roster, rules, onSelectCharacter, onUpdateRaidSelection }) {
  if (!roster) {
    return <Empty title="캐릭터 정보가 없습니다" message="대표 캐릭터명을 검색하면 상세 정보가 표시됩니다." />;
  }

  const armory = roster.armory || {};
  const profile = armory.profile;
  const selectedName = roster.selectedCharacterName || roster.representative;
  const fallback = roster.characters.find((character) => character.CharacterName === selectedName);
  const character = profile || fallback;

  if (!character) {
    return <Empty title="캐릭터 정보가 없습니다" message="보유 캐릭터 목록에서 캐릭터를 선택하세요." />;
  }

  const characterName = character.CharacterName || selectedName;
  const title = parseIconText(profile?.Title || "칭호 없음");
  const equipmentItems = mapEquipment(armory.equipment);
  const engravingItems = mapEngravings(armory.engravings);
  const gemItems = mapGems(armory.gems);
  const cardItems = mapCards(armory.cards);
  const arkItems = mapArkPassive(armory.arkpassive, armory.arkgrid);
  const selectedRaidIds = getCharacterRaidSelection(character, roster, rules);
  const defaultRaidIds = getDefaultRaidSelection(character, rules);
  const eligibleRules = getEligibleRulesForCharacter(character, rules);

  function toggleRaid(ruleId) {
    const exists = selectedRaidIds.includes(ruleId);
    const rule = rules.find((item) => item.id === ruleId);
    const groupId = rule?.groupId || rule?.id;
    const withoutSameGroup = selectedRaidIds.filter((id) => {
      const selectedRule = rules.find((item) => item.id === id);
      return (selectedRule?.groupId || selectedRule?.id) !== groupId;
    });
    const nextRaidIds = exists ? withoutSameGroup : limitRaidSelection([ruleId, ...withoutSameGroup], rules);

    onUpdateRaidSelection(characterName, nextRaidIds);
  }

  return (
    <section className={styles.armoryLayout}>
      <article className={styles.characterHero}>
        <div className={styles.characterPortrait}>
          {profile?.CharacterImage ? <img src={profile.CharacterImage} alt={characterName} /> : <div className={styles.imageFallback} />}
        </div>

        <div className={styles.characterIdentity}>
          <div className={styles.characterMeta}>
            <span>{character.ServerName || "-"}</span>
            <span>{character.CharacterClassName || "-"}</span>
          </div>
          <h3>{characterName}</h3>
          <IconText item={title} className={styles.titleLine} />
          <div className={styles.identityBadges}>
            <span>{profile?.GuildName ? `길드 ${profile.GuildName}` : "길드 없음"}</span>
            <span>{profile?.TownName ? `영지 ${profile.TownName}` : "영지 정보 없음"}</span>
            <span>{profile?.PvpGradeName || "PVP 정보 없음"}</span>
          </div>
        </div>

        <div className={styles.characterSummary}>
          <SummaryItem label="아이템" value={character.ItemAvgLevel || "-"} highlight />
          <SummaryItem label="전투력" value={profile?.CombatPower || "-"} />
          <SummaryItem label="전투" value={formatLevel(character.CharacterLevel)} />
          <SummaryItem label="원정대" value={formatLevel(profile?.ExpeditionLevel)} />
          <SummaryItem label="최고 레벨" value={profile?.ItemMaxLevel || "-"} />
          <SummaryItem label="스킬 포인트" value={formatSkillPoint(profile)} />
        </div>
      </article>

      <GemStrip items={gemItems} profile={profile} />
      <EquipmentBoard items={equipmentItems} />

      <div className={styles.characterDetailGrid}>
        <section className={styles.detailColumn}>
          <StatList title="전투 정보" items={buildCombatSummary(character, profile)} />
          <StatList title="전투 특성" items={mapStats(profile?.Stats)} accent />
          <StatList title="성향" items={mapTendencies(profile?.Tendencies)} />
        </section>

        <section className={styles.detailColumn}>
          <ArmoryBoard title="각인" items={engravingItems} compact />
          <CardBoard items={cardItems} />
        </section>

        <aside className={styles.detailColumn}>
          <ArmoryBoard title="아크 패시브" items={arkItems} />
          <RaidSelector
            rules={rules}
            eligibleRules={eligibleRules}
            selectedRaidIds={selectedRaidIds}
            onToggle={toggleRaid}
            onReset={() => onUpdateRaidSelection(characterName, defaultRaidIds)}
          />
          <MiniRoster roster={roster} onSelectCharacter={onSelectCharacter} />
        </aside>
      </div>
    </section>
  );
}

function IconText({ item, className = "" }) {
  return (
    <span className={className}>
      {item.icon && <img src={item.icon} alt="" onError={(event) => event.currentTarget.remove()} />}
      {item.name || "-"}
    </span>
  );
}

function SummaryItem({ label, value, highlight = false }) {
  return (
    <div className={`${styles.summaryItem} ${highlight ? styles.summaryHighlight : ""}`}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function GemStrip({ items, profile }) {
  const damageGems = items.filter((item) => item.kind === "damage");
  const cooldownGems = items.filter((item) => item.kind === "cooldown");
  const otherGems = items.filter((item) => item.kind === "other");

  return (
    <article className={styles.gemStripPanel}>
      <GemStripGroup label="피해" items={damageGems} />
      <GemStripGroup label="쿨감" items={cooldownGems} />
      {otherGems.length > 0 && <GemStripGroup label="기타" items={otherGems} />}
      <div className={styles.basicAttackBox}>
        <span>기본 공격력</span>
        <strong>{formatAttackPower(profile?.CombatPower)}</strong>
      </div>
    </article>
  );
}

function GemStripGroup({ label, items }) {
  return (
    <div className={styles.gemStripGroup}>
      <b>{label}</b>
      <div className={styles.gemIconLine}>
        {items.length === 0 && <span className={styles.emptyPanelText}>-</span>}
        {items.map((item, index) => (
          <div className={styles.gemIconBox} title={item.name} key={`${item.name}-${index}`}>
            {item.icon && <img src={item.icon} alt="" />}
            <span>{item.levelNumber || item.levelText || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquipmentBoard({ items }) {
  const averageQuality = average(items.map((item) => item.quality).filter((quality) => Number.isFinite(quality)));

  return (
    <article className={styles.loawaPanel}>
      <header>
        <div>
          <span>Equipment</span>
          <h3>장비</h3>
        </div>
        <strong>품질 {averageQuality || "-"}</strong>
      </header>
      <div className={styles.equipmentBoard}>
        {items.length === 0 && <div className={styles.emptyPanelText}>표시할 장비 정보가 없습니다.</div>}
        {items.map((item) => (
          <div className={`${styles.equipmentSlot} ${!item.icon ? styles.noIconSlot : ""}`} key={`${item.type}-${item.name}`}>
            {item.icon && <img src={item.icon} alt="" />}
            <div>
              <b>{item.type || "장비"}</b>
              <strong>{item.name || "-"}</strong>
              <small>{[item.grade, item.levelText].filter(Boolean).join(" · ") || "-"}</small>
            </div>
            <QualityBadge value={item.quality} />
          </div>
        ))}
      </div>
    </article>
  );
}

function StatList({ title, items, accent = false }) {
  return (
    <article className={styles.loawaPanel}>
      <header>
        <div>
          <span>Character</span>
          <h3>{title}</h3>
        </div>
        <strong>{items.length}개</strong>
      </header>
      <div className={styles.statRows}>
        {items.length === 0 && <div className={styles.emptyPanelText}>표시할 정보가 없습니다.</div>}
        {items.map((item) => (
          <div className={styles.statRow} key={item.label}>
            <span>{item.label}</span>
            <strong className={accent ? styles.accentValue : ""}>{item.value || "-"}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function CardBoard({ items }) {
  return (
    <article className={styles.loawaPanel}>
      <header>
        <div>
          <span>Cards</span>
          <h3>카드</h3>
        </div>
        <strong>{items.length}개</strong>
      </header>
      <div className={styles.cardGrid}>
        {items.length === 0 && <div className={styles.emptyPanelText}>표시할 카드 정보가 없습니다.</div>}
        {items.map((item) => (
          <div className={`${styles.cardTile} ${!item.icon ? styles.noIconCard : ""}`} key={`${item.name}-${item.meta}`}>
            {item.icon && <img src={item.icon} alt="" />}
            <div>
              <strong>{item.name || "-"}</strong>
              <small>{item.meta || "-"}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ArmoryBoard({ title, items, compact = false }) {
  return (
    <article className={styles.loawaPanel}>
      <header>
        <div>
          <span>Armory</span>
          <h3>{title}</h3>
        </div>
        <strong>{items.length}개</strong>
      </header>
      <div className={compact ? styles.compactArmoryList : styles.armoryList}>
        {items.length === 0 && <div className={styles.emptyPanelText}>표시할 정보가 없습니다.</div>}
        {items.map((item, index) => (
          <div className={`${styles.armoryItem} ${!item.icon ? styles.textOnlyArmoryItem : ""}`} key={`${item.name}-${index}`}>
            {item.icon && <img src={item.icon} alt="" onError={(event) => event.currentTarget.remove()} />}
            <strong>{item.name || "-"}</strong>
            <div className={styles.effectBadges}>
              {item.badges.map((badge, badgeIndex) => (
                <b className={badge.tone === "blue" ? styles.blueBadge : ""} key={`${badge.text}-${badgeIndex}`}>
                  {badge.text}
                </b>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function RaidSelector({ rules, eligibleRules, selectedRaidIds, onToggle, onReset }) {
  const selectedRules = selectedRaidIds
    .map((id) => rules.find((rule) => rule.id === id))
    .filter(Boolean);
  const selectedGroupIds = selectedRules.map((rule) => rule.groupId || rule.id);
  const addableRules = eligibleRules.filter((rule) => !selectedGroupIds.includes(rule.groupId || rule.id));
  const canAdd = selectedRaidIds.length < WEEKLY_RAID_LIMIT && addableRules.length > 0;

  function addRaid() {
    const nextRule = addableRules[0];
    if (nextRule) onToggle(nextRule.id);
  }

  function changeRaid(previousRuleId, nextRuleId) {
    if (previousRuleId === nextRuleId) return;
    onToggle(nextRuleId);
  }

  return (
    <article className={styles.raidSelector}>
      <header>
        <div>
          <span>Weekly Raids</span>
          <h3>주간 레이드 선택</h3>
        </div>
        <div>
          <strong>
            {selectedRaidIds.length}/{WEEKLY_RAID_LIMIT}
          </strong>
          <button type="button" onClick={onReset}>
            상위 3개
          </button>
        </div>
      </header>
      <div className={styles.raidSelectList}>
        {eligibleRules.length === 0 && <div className={styles.emptyPanelText}>입장 가능한 레이드가 없습니다.</div>}
        {selectedRules.map((selectedRule, index) => {
          const selectedGroupId = selectedRule.groupId || selectedRule.id;
          const options = eligibleRules.filter((rule) => {
            const groupId = rule.groupId || rule.id;
            return groupId === selectedGroupId || !selectedGroupIds.includes(groupId);
          });

          return (
            <div className={styles.raidSelectRow} key={selectedRule.id}>
              <span>{index + 1}</span>
              <select value={selectedRule.id} onChange={(event) => changeRaid(selectedRule.id, event.target.value)}>
                {options.map((rule) => (
                  <option value={rule.id} key={rule.id}>
                    {rule.name} / {rule.minLevel.toLocaleString("ko-KR")}+ / {rule.maxMembers}인
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => onToggle(selectedRule.id)} aria-label={`${selectedRule.name} 제거`}>
                x
              </button>
            </div>
          );
        })}
        {canAdd && (
          <button className={styles.addRaidButton} type="button" onClick={addRaid}>
            + 레이드 추가
          </button>
        )}
      </div>
    </article>
  );
}

function MiniRoster({ roster, onSelectCharacter }) {
  const characters = roster.characters
    .map((character) => normalizeCharacter(character, roster.representative))
    .sort((a, b) => b.itemLevel - a.itemLevel)
    .slice(0, 8);

  return (
    <article className={styles.loawaPanel}>
      <header>
        <div>
          <span>Roster</span>
          <h3>보유 캐릭터</h3>
        </div>
        <strong>{roster.characters.length}명</strong>
      </header>
      <div className={styles.compactRoster}>
        {characters.map((character) => (
          <button type="button" key={character.name} onClick={() => onSelectCharacter(character.name)}>
            <strong>{character.name}</strong>
            <span>
              {character.className} · {character.itemLevelText}
            </span>
          </button>
        ))}
      </div>
    </article>
  );
}

function QualityBadge({ value }) {
  if (!Number.isFinite(value)) return <span className={styles.qualityBadge}>-</span>;
  return <span className={styles.qualityBadge}>{value}</span>;
}

function Empty({ title, message }) {
  return (
    <section className={styles.empty}>
      <div />
      <h3>{title}</h3>
      <p>{message}</p>
    </section>
  );
}

function buildCombatSummary(character, profile) {
  return [
    { label: "공격력", value: profile?.CombatPower },
    { label: "최대 생명력", value: findStat(profile?.Stats, "최대 생명력") },
    { label: "아이템 레벨", value: character.ItemAvgLevel },
    { label: "전투 레벨", value: formatLevel(character.CharacterLevel) },
    { label: "원정대", value: formatLevel(profile?.ExpeditionLevel) },
    { label: "스킬 포인트", value: formatSkillPoint(profile) },
  ].filter((item) => item.value);
}

function mapStats(stats) {
  return Array.isArray(stats) ? stats.map((stat) => ({ label: stat.Type, value: stat.Value })) : [];
}

function mapTendencies(tendencies) {
  return Array.isArray(tendencies)
    ? tendencies.map((tendency) => ({ label: tendency.Type, value: `${tendency.Point || 0}/${tendency.MaxPoint || "-"}` }))
    : [];
}

function mapEquipment(equipment) {
  return Array.isArray(equipment)
    ? equipment.map((item) => {
        const images = getImagesFromValue(item);
        return {
          type: item.Type,
          name: stripHtml(item.Name),
          grade: item.Grade,
          quality: parseQuality(item.Tooltip),
          levelText: parseEquipmentLevel(item.Name, item.Tooltip),
          icon: item.Icon || images[0],
        };
      })
    : [];
}

function mapEngravings(engravings) {
  const effects = engravings?.Effects || engravings?.ArkPassiveEffects || [];
  return effects.map((item) => mapEffectItem(item, "각인 정보"));
}

function mapGems(gems) {
  return (gems?.Gems || []).map((gem) => {
    const images = getImagesFromValue(gem);
    const levelText = gem.Level ? `Lv.${gem.Level}` : parseGemLevel(gem.Name);
    return {
      name: stripHtml(gem.Name),
      meta: [levelText, gem.SkillName, gem.Grade].filter(Boolean).join(" · "),
      levelText,
      levelNumber: String(gem.Level || levelText.match(/\d+/)?.[0] || ""),
      skillName: gem.SkillName,
      kind: getGemKind(gem),
      icon: gem.Icon || images[0],
    };
  });
}

function mapCards(cards) {
  return [
    ...(cards?.Cards || []).map((card) => {
      const images = getImagesFromValue(card);
      return {
        name: stripHtml(card.Name),
        meta: [card.AwakeCount ? `${card.AwakeCount}각성` : "", card.Grade].filter(Boolean).join(" · "),
        icon: card.Icon || images[0],
      };
    }),
    ...(cards?.Effects || []).map((effect) => ({ name: stripHtml(effect.Name), meta: stripHtml(effect.Description) })),
  ];
}

function mapArkPassive(arkpassive, arkgrid) {
  const points = arkpassive?.Points || arkpassive?.ArkPassivePoints || [];
  const effects = arkpassive?.Effects || arkpassive?.ArkPassiveEffects || [];
  const gridEffects = arkgrid?.Effects || [];

  return [
    ...points.map((point) => ({
      ...mapEffectItem(point, point.Name || point.Type),
      badges: [{ text: `${point.Value ?? point.Point ?? "-"}P` }],
    })),
    ...effects.map((effect) => mapEffectItem(effect, "아크 패시브")),
    ...gridEffects.map((effect) => mapEffectItem(effect, "아크 그리드")),
  ];
}

function mapEffectItem(item, fallbackName) {
  const raw = item.Name || item.Description || fallbackName;
  const parsed = parseIconText(raw);
  const description = parseIconText(item.Description || "");
  const level = item.Level || parseLevelText(raw) || parseLevelText(item.Description);
  const numericBadge = parseTrailingNumber(raw);
  const images = getImagesFromValue(item);
  const icon = item.Icon || parsed.icon || description.icon || images[0];

  return {
    name: cleanEffectName(parsed.name || description.name || fallbackName),
    icon,
    badges: [
      ...(level ? [{ text: level, tone: "blue" }] : []),
      ...(numericBadge && numericBadge !== level ? [{ text: numericBadge }] : []),
    ],
  };
}

function parseIconText(value) {
  const text = String(value || "");
  const imgMatch = text.match(/<img\b[^>]*\bsrc=['"]?([^'"\s>]+)['"]?[^>]*>/i);
  return {
    icon: imgMatch ? resolveAssetUrl(imgMatch[1]) : "",
    name: stripHtml(text).trim(),
  };
}

function resolveAssetUrl(src) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `/api/asset?name=${encodeURIComponent(src.replace(/\.(png|jpg|jpeg|webp)$/i, ""))}`;
}

function getGemKind(gem) {
  const text = [gem.Name, gem.Type, gem.Effect, gem.SkillName, plainTooltip(gem.Tooltip)].filter(Boolean).join(" ");
  if (/멸화|겁화|피해|데미지|damage/i.test(text)) return "damage";
  if (/홍염|작열|쿨|재사용|cool/i.test(text)) return "cooldown";
  return "other";
}

function findStat(stats, label) {
  return stats?.find((stat) => stat.Type === label)?.Value || "";
}

function formatSkillPoint(profile) {
  if (!profile?.UsingSkillPoint && !profile?.TotalSkillPoint) return "";
  return `${profile.UsingSkillPoint || 0} / ${profile.TotalSkillPoint || 0}`;
}

function formatLevel(value) {
  return value ? `Lv.${value}` : "-";
}

function formatAttackPower(value) {
  if (!value) return "-";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString("ko-KR");
}

function average(values) {
  if (!values.length) return "";
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function parseQuality(tooltip) {
  const text = plainTooltip(tooltip);
  const match = text.match(/품질[^0-9]*(\d{1,3})/);
  return match ? Number(match[1]) : undefined;
}

function parseEquipmentLevel(name, tooltip) {
  const text = [name, plainTooltip(tooltip)].filter(Boolean).join(" ");
  const reinforce = text.match(/\+\d+/)?.[0];
  const tier = text.match(/T\d/)?.[0];
  return [reinforce, tier].filter(Boolean).join(" ");
}

function parseGemLevel(name) {
  return name?.match(/\d+레벨|Lv\.?\s*\d+/i)?.[0] || "";
}

function parseLevelText(value) {
  return String(value || "").match(/Lv\.?\s*\d+|\d+\s*레벨|레벨\s*\d+/i)?.[0] || "";
}

function parseTrailingNumber(value) {
  return String(value || "").match(/(?:^|\s)(\d+)$/)?.[1] || "";
}

function cleanEffectName(value) {
  return stripHtml(value)
    .replace(/Lv\.?\s*\d+/gi, "")
    .replace(/\d+\s*레벨/gi, "")
    .replace(/레벨\s*\d+/gi, "")
    .replace(/\s+\d+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function plainTooltip(tooltip) {
  if (!tooltip) return "";
  try {
    const parsed = JSON.parse(tooltip);
    return JSON.stringify(parsed).replace(/<[^>]+>/g, " ");
  } catch {
    return String(tooltip).replace(/<[^>]+>/g, " ");
  }
}

function getImagesFromValue(value) {
  const images = [];
  const seen = new Set();
  collectImagesFromValue(value, images, seen);
  return images;
}

function collectImagesFromValue(value, images, seen) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImagesFromValue(item, images, seen));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string") {
        const keyLooksLikeImage = /image|icon|thumbnail|background/i.test(key);
        const urls = keyLooksLikeImage ? [child, ...extractImageUrls(child)] : extractImageUrls(child);
        urls.forEach((url) => {
          const normalized = normalizeImageUrl(url);
          if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            images.push(normalized);
          }
        });
        extractInternalAssets(child).forEach((asset) => {
          const normalized = resolveAssetUrl(asset);
          if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            images.push(normalized);
          }
        });
      } else {
        collectImagesFromValue(child, images, seen);
      }
    }
    return;
  }
  if (typeof value === "string") {
    extractImageUrls(value).forEach((url) => {
      const normalized = normalizeImageUrl(url);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        images.push(normalized);
      }
    });
    extractInternalAssets(value).forEach((asset) => {
      const normalized = resolveAssetUrl(asset);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        images.push(normalized);
      }
    });
  }
}

function extractImageUrls(value) {
  if (typeof value !== "string") return [];
  const text = value.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  return text.match(/https?:\/\/[^"'\\\s<>]+?\.(?:png|jpg|jpeg|webp|gif)(?:\?[^"'\\\s<>]*)?/gi) || [];
}

function extractInternalAssets(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/<img\b[^>]*\bsrc=['"]?([^'"\s>]+)['"]?[^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => src && !/^https?:\/\//i.test(src));
}

function normalizeImageUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  if (!/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(trimmed)) return "";
  return trimmed;
}
