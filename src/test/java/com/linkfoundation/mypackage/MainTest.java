package com.linkfoundation.mypackage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Integration tests for {@link Main}. */
@DisplayName("Main")
class MainTest {

  @Test
  @DisplayName("main method runs without throwing exceptions")
  void mainRunsSuccessfully() {
    assertDoesNotThrow(() -> Main.main(new String[] {}));
  }

  @Test
  @DisplayName("main method handles null arguments")
  void mainHandlesNullArgs() {
    assertDoesNotThrow(() -> Main.main(null));
  }
}
