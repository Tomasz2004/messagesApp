package com.ochrona.messagesApp.repository;

import com.ochrona.messagesApp.entity.MessageRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRecipientRepository extends JpaRepository<MessageRecipient, Long> {

    // Dla odebranych wiadomości - tylko gdzie NIE jest nadawcą (isSender = false)
    List<MessageRecipient> findByRecipientIdAndDeletedFalseAndIsSenderFalseOrderByMessageCreatedAtDesc(
            Long recipientId);

    List<MessageRecipient> findByMessageId(Long messageId);

    Optional<MessageRecipient> findByMessageIdAndRecipientId(Long messageId, Long recipientId);

    // Dla wysłanych wiadomości - tylko kopia nadawcy (isSender = true)
    List<MessageRecipient> findByRecipientIdAndDeletedFalseAndIsSenderTrueOrderByMessageCreatedAtDesc(Long recipientId);

    @Query("SELECT COUNT(mr) FROM MessageRecipient mr WHERE mr.recipient.id = :recipientId AND mr.isRead = false AND mr.deleted = false AND mr.isSender = false")
    long countUnreadByRecipientId(@Param("recipientId") Long recipientId);
}
