# Correção — erro `finished_at` ao finalizar viagem

## Causa identificada

A tela "Registrar Retorno" tenta gravar um campo de data de conclusão que **não existe** na tabela de viagens.

- O campo `finished_at` existe apenas na tabela de bloqueios de veículo (manutenção/indisponibilidade), onde é usado corretamente.
- A tabela de solicitações de viagem registra a conclusão apenas pela mudança de situação para `CONCLUIDA`, junto com o odômetro final. Não há, nem nunca houve, um campo de data de conclusão nela.
- Por isso o backend responde: "Could not find the 'finished_at' column of 'trip_requests'".

Não é um problema de cache: é uma referência a coluna inexistente no código do diálogo de quilometragem.

## Correção

Alteração pontual em um único ponto do código (diálogo de registro de quilometragem):

- Ao finalizar, gravar somente odômetro final e situação `CONCLUIDA` — removendo a referência ao campo inexistente.
- Nada mais muda: validações de odômetro, permissões, histórico de quilometragem e o restante do fluxo continuam idênticos.

## O que NÃO será feito

- Nenhuma migração de banco, nenhuma coluna nova, nenhuma tabela nova.
- Nenhuma alteração de RLS, permissões ou de viagens já existentes.
- Nenhuma mudança no cálculo do odômetro nem em outras telas.

## Detalhes técnicos

Em `src/components/TripMileageDialog.tsx`, no `handleSubmit`, o objeto de atualização do modo `end` passa de
`{ odometer_end, status: "CONCLUIDA", finished_at: ... }` para `{ odometer_end, status: "CONCLUIDA" }`.
A chamada seguinte à RPC `update_vehicle_odometer` permanece inalterada. A data efetiva da conclusão continua rastreável por `updated_at` e pelo registro em `odometer_history` / `trip_history`.
