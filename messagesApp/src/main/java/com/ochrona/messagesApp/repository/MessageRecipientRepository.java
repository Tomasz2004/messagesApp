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

    List<MessageRecipient> findByRecipientIdAndDeletedFalseOrderByMessageCreatedAtDesc(Long recipientId);

    List<MessageRecipient> findByMessageId(Long messageId);

    Optional<MessageRecipient> findByMessageIdAndRecipientId(Long messageId, Long recipientId);

    @Query("SELECT COUNT(mr) FROM MessageRecipient mr WHERE mr.recipient.id = :recipientId AND mr.isRead = false AND mr.deleted = false")
    long countUnreadByRecipientId(@Param("recipientId") Long recipientId);
}
