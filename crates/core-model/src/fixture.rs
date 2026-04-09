/// Origen de un fixture: embebido en el binario o cargado desde disco.
///
/// Compartido por todos los adapters que trabajan con fixtures en fases anteriores
/// a la integración con el sistema real.
#[derive(Debug, Clone, PartialEq)]
pub enum FixtureSource {
    /// Fixture embebido mediante `include_str!` (fase 1).
    Embedded,
    /// Fixture cargado desde un path en disco (fase 2+).
    #[allow(dead_code)]
    Path(String),
}
