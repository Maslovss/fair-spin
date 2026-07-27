# Delta for Tables

## ADDED Requirements

### Requirement: Result Label Reflects Current Table State

Підпис результату SHALL показувати результат останньої завершеної дії на **поточному** столі.

Підпис MUST зникати, коли стіл повертається до стану, у якому результату ще немає:

- при перемиканні на інший стіл;
- при відкритті пресету;
- після скидання раунду;
- після перемикання режиму гри;
- після збирання колоди на столі карт;
- після перезавантаження застосунку.

Підпис MUST NOT зберігатися між сесіями й MUST NOT показувати результат, отриманий на іншому столі.

#### Scenario: Switching tables clears the label

- GIVEN на колесі показано результат
- WHEN гравець перемикається на інший стіл
- THEN підпису результату немає

#### Scenario: Undealt deck shows no result

- GIVEN на столі карт колоду зібрано й ще не роздано
- WHEN гравець дивиться на стіл
- THEN підпису результату немає

#### Scenario: Label persists while the table is unchanged

- GIVEN гравець зробив кидок на колесі
- WHEN такт визнання завершився і гравець лишається на колесі
- THEN підпис показує саме цей результат

#### Scenario: Reset clears the label

- GIVEN показано результат
- WHEN гравець скидає раунд
- THEN підпису результату немає

#### Scenario: Mode change clears the label

- GIVEN показано результат
- WHEN гравець перемикає режим гри
- THEN підпису результату немає

#### Scenario: Label is not restored after reload

- GIVEN гравець отримав результат і перезавантажив застосунок
- WHEN пресет відкривається знову
- THEN підпису результату немає
- AND цвинтар лишається незмінним

#### Scenario: Final act label matches the table

- GIVEN у раунді лишився один елемент
- WHEN гравець обирає його
- THEN підпис показує саме цей елемент
